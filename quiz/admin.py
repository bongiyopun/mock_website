from django.contrib import admin
from django.db.models import Count
from django.urls import path
from django.shortcuts import render, redirect
from django.contrib import messages
from django.http import HttpResponse
import csv
import io
from .models import Quiz, Question, Choice, TestAttempt, UserAnswer


class ChoiceInline(admin.TabularInline):
    model = Choice
    extra = 4
    max_num = 4


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('id', 'quiz', 'text_short', 'marks', 'has_image')
    list_filter = ('quiz',)
    search_fields = ('text', 'quiz__title')
    inlines = [ChoiceInline]

    def text_short(self, obj):
        return obj.text[:80] + '...' if len(obj.text) > 80 else obj.text
    text_short.short_description = 'Question'

    def has_image(self, obj):
        return bool(obj.image)
    has_image.boolean = True
    has_image.short_description = 'Image'


@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ('title', 'time_limit', 'difficulty', 'is_published', 'requires_login',
                    'negative_marking', 'results_activated', 'get_question_count', 'get_attempt_count', 'created_at')
    list_filter = ('is_published', 'requires_login', 'results_activated', 'difficulty')
    search_fields = ('title', 'description')
    list_editable = ('is_published', 'requires_login', 'results_activated')
    change_list_template = 'admin/quiz/quiz_changelist.html'
    fieldsets = (
        ('Basic Info', {
            'fields': ('title', 'description', 'difficulty', 'time_limit', 'passing_score')
        }),
        ('Scoring', {
            'fields': ('negative_marking',),
            'description': (
                'Set the negative marking fraction. '
                'E.g. 0 = no penalty, 0.25 = 1/4 deduction, 0.33 = 1/3 deduction, 1 = full deduction.'
            )
        }),
        ('Access & Publishing', {
            'fields': ('is_published', 'requires_login', 'results_activated')
        }),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            question_count=Count('questions', distinct=True),
            attempt_count=Count('attempts', distinct=True),
        )

    def get_question_count(self, obj):
        return obj.question_count
    get_question_count.short_description = 'Questions'
    get_question_count.admin_order_field = 'question_count'

    def get_attempt_count(self, obj):
        return obj.attempt_count
    get_attempt_count.short_description = 'Attempts'
    get_attempt_count.admin_order_field = 'attempt_count'

    def get_urls(self):
        custom_urls = [
            path('bulk-upload/', self.admin_site.admin_view(self.bulk_upload_view),
                 name='quiz_bulk_upload'),
            path('download-csv-template/', self.admin_site.admin_view(self.download_csv_template),
                 name='quiz_csv_template'),
        ]
        return custom_urls + super().get_urls()

    def bulk_upload_view(self, request):
        if request.method == 'POST':
            csv_file = request.FILES.get('csv_file')
            quiz_id = request.POST.get('quiz_id')

            if not csv_file or not quiz_id:
                messages.error(request, 'Please select a quiz and upload a CSV file.')
                return redirect('admin:quiz_bulk_upload')

            if not csv_file.name.lower().endswith('.csv'):
                messages.error(request, 'Please upload a valid .csv file.')
                return redirect('admin:quiz_bulk_upload')

            try:
                quiz = Quiz.objects.get(id=quiz_id)
                decoded = csv_file.read().decode('utf-8-sig')
                reader = csv.DictReader(io.StringIO(decoded))
                created, errors = 0, []

                for row_num, row in enumerate(reader, start=2):
                    try:
                        qt = row.get('question_text', '').strip()
                        oa = row.get('option_a', '').strip()
                        ob = row.get('option_b', '').strip()
                        oc = row.get('option_c', '').strip()
                        od = row.get('option_d', '').strip()
                        correct = row.get('correct_option', '').strip().upper()
                        marks = int(row.get('marks', '1').strip() or '1')

                        if not qt:
                            errors.append(f'Row {row_num}: Missing question text')
                            continue
                        if not all([oa, ob, oc, od]):
                            errors.append(f'Row {row_num}: Missing option(s)')
                            continue
                        if correct not in ('A', 'B', 'C', 'D'):
                            errors.append(f'Row {row_num}: correct_option must be A/B/C/D')
                            continue

                        question = Question.objects.create(quiz=quiz, text=qt, marks=marks)
                        for key, text in {'A': oa, 'B': ob, 'C': oc, 'D': od}.items():
                            Choice.objects.create(
                                question=question, text=text,
                                is_correct=(key == correct),
                            )
                        created += 1
                    except Exception as e:
                        errors.append(f'Row {row_num}: {e}')

                if created:
                    messages.success(request, f'Added {created} question(s) to "{quiz.title}".')
                if errors:
                    msg = f'{len(errors)} error(s): ' + '; '.join(errors[:5])
                    if len(errors) > 5:
                        msg += f' ... and {len(errors) - 5} more'
                    messages.warning(request, msg)

            except Quiz.DoesNotExist:
                messages.error(request, 'Selected quiz not found.')
            except Exception as e:
                messages.error(request, f'Error processing file: {e}')

            return redirect('admin:quiz_bulk_upload')

        context = {
            **self.admin_site.each_context(request),
            'title': 'Bulk Upload Questions',
            'quizzes': Quiz.objects.all().order_by('-created_at'),
            'opts': self.model._meta,
        }
        return render(request, 'admin/quiz/bulk_upload.html', context)

    def download_csv_template(self, request):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="questions_template.csv"'
        writer = csv.writer(response)
        writer.writerow(['question_text', 'option_a', 'option_b', 'option_c',
                         'option_d', 'correct_option', 'marks'])
        writer.writerow(['What is the capital of France?',
                         'London', 'Paris', 'Berlin', 'Madrid', 'B', '1'])
        writer.writerow(['Which planet is closest to the sun?',
                         'Venus', 'Mercury', 'Earth', 'Mars', 'B', '2'])
        return response


class UserAnswerInline(admin.TabularInline):
    model = UserAnswer
    extra = 0
    readonly_fields = ('question', 'get_question_marks', 'selected_choice',
                       'is_correct', 'marks_awarded')
    can_delete = False

    def get_question_marks(self, obj):
        return obj.question.marks if obj.question else 0
    get_question_marks.short_description = 'Max Marks'

    def is_correct(self, obj):
        return obj.selected_choice.is_correct if obj.selected_choice else False
    is_correct.boolean = True
    is_correct.short_description = 'Correct?'

    def marks_awarded(self, obj):
        if not obj.selected_choice:
            return 0
        quiz = obj.attempt.quiz
        if obj.selected_choice.is_correct:
            return obj.question.marks
        # Apply quiz-level negative marking penalty
        penalty = round(float(obj.question.marks) * quiz.negative_marking, 2)
        return -penalty
    marks_awarded.short_description = 'Marks Awarded'


@admin.register(TestAttempt)
class TestAttemptAdmin(admin.ModelAdmin):
    list_display = ('user', 'quiz', 'score', 'start_time', 'end_time', 'is_completed')
    list_filter = ('is_completed', 'quiz')
    search_fields = ('user__username', 'quiz__title')
    readonly_fields = ('start_time',)
    inlines = [UserAnswerInline]