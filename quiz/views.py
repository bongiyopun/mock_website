import json
from django.http import JsonResponse
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import render
from django.utils import timezone
from .models import Quiz, Question, Choice, TestAttempt, UserAnswer


def spa_view(request):
    return render(request, 'quiz/spa.html')


@csrf_exempt
def register_api(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')
            if not username or not password:
                return JsonResponse({'error': 'Username and password are required'}, status=400)
            if User.objects.filter(username=username).exists():
                return JsonResponse({'error': 'Username already exists'}, status=400)
            User.objects.create_user(username=username, password=password)
            return JsonResponse({'message': 'Registration successful! Please login.'}, status=201)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def login_api(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            user = authenticate(request, username=data.get('username'), password=data.get('password'))
            if user is not None:
                login(request, user)
                return JsonResponse({'message': 'Login successful', 'user': {'username': user.username}})
            else:
                return JsonResponse({'error': 'Invalid credentials'}, status=401)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def logout_api(request):
    logout(request)
    return JsonResponse({'message': 'Logged out successfully'})


def me_api(request):
    if request.user.is_authenticated:
        return JsonResponse({'isAuthenticated': True, 'user': {'username': request.user.username}})
    return JsonResponse({'isAuthenticated': False})


def home_quiz_api(request):
    # Show a featured quiz that doesn't necessarily require login if possible
    quiz = Quiz.objects.filter(is_published=True).order_by('requires_login', '-created_at').first()
    if quiz:
        return JsonResponse({'quiz': {
            'id': quiz.id, 'title': quiz.title, 'description': quiz.description,
            'difficulty': quiz.difficulty, 'time_limit': quiz.time_limit,
            'requires_login': quiz.requires_login,
        }})
    return JsonResponse({'quiz': None})


def quizzes_api(request):
    # Public quizzes are show to everyone; private ones only to logged-in users
    quizzes = Quiz.objects.filter(is_published=True)
    if not request.user.is_authenticated:
        quizzes = quizzes.filter(requires_login=False)
        
    data = []
    for q in quizzes:
        quiz_data = {
            'id': q.id, 'title': q.title, 'description': q.description,
            'difficulty': q.difficulty, 'time_limit': q.time_limit,
            'requires_login': q.requires_login,
            'status': 'not_attempted',  # default
        }
        if request.user.is_authenticated:
            completed = TestAttempt.objects.filter(user=request.user, quiz=q, is_completed=True).first()
            in_progress = TestAttempt.objects.filter(user=request.user, quiz=q, is_completed=False).first()
            if completed:
                quiz_data['status'] = 'completed_published' if q.results_activated else 'completed_pending'
                quiz_data['attempt_id'] = completed.id
            elif in_progress:
                quiz_data['status'] = 'in_progress'
        data.append(quiz_data)
    return JsonResponse({'quizzes': data})


def quiz_detail_api(request, quiz_id):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Unauthorized'}, status=401)
    try:
        quiz = Quiz.objects.get(id=quiz_id, is_published=True)
        best = TestAttempt.objects.filter(
            user=request.user, quiz=quiz, is_completed=True
        ).order_by('-score').first()
        return JsonResponse({
            'quiz': {
                'id': quiz.id, 'title': quiz.title, 'description': quiz.description,
                'time_limit': quiz.time_limit, 'passing_score': quiz.passing_score,
                'difficulty': quiz.difficulty,
            },
            'previous_best_score': best.score if best else None,
        })
    except Quiz.DoesNotExist:
        return JsonResponse({'error': 'Quiz not found'}, status=404)


@csrf_exempt
def attempt_quiz_api(request, quiz_id):
    try:
        quiz = Quiz.objects.get(id=quiz_id, is_published=True)
    except Quiz.DoesNotExist:
        return JsonResponse({'error': 'Quiz not found'}, status=404)

    # Check access
    if quiz.requires_login and not request.user.is_authenticated:
        return JsonResponse({'error': 'Login required for this test'}, status=401)

    # Identification for attempt tracking
    user = request.user if request.user.is_authenticated else None
    
    # Restrict to one attempt only for logged-in users
    if user:
        existing_completed = TestAttempt.objects.filter(user=user, quiz=quiz, is_completed=True).first()
        if existing_completed:
            return JsonResponse({
                'already_attempted': True,
                'attempt_id': existing_completed.id,
                'message': 'You have already attempted this mock test.'
            })
        attempt = TestAttempt.objects.filter(user=user, quiz=quiz, is_completed=False).first()
    else:
        # Guests: track via session
        if not request.session.session_key:
            request.session.create()
        attempt_id = request.session.get(f'guest_attempt_{quiz_id}')
        attempt = TestAttempt.objects.filter(id=attempt_id, is_completed=False).first() if attempt_id else None

    if not attempt:
        attempt = TestAttempt.objects.create(
            user=user, 
            quiz=quiz,
            time_remaining_seconds=quiz.time_limit * 60
        )
        if not user:
            request.session[f'guest_attempt_{quiz_id}'] = attempt.id

    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            answers = data.get('answers', {})
            score = 0.0
            for question in quiz.questions.all():
                choice_id = answers.get(str(question.id))
                selected_choice = None
                if choice_id is not None:
                    try:
                        selected_choice = Choice.objects.get(id=choice_id, question=question)
                        if selected_choice.is_correct:
                            score += float(question.marks)
                        else:
                            score -= float(question.marks) * quiz.negative_marking
                    except Choice.DoesNotExist:
                        pass
                UserAnswer.objects.update_or_create(
                    attempt=attempt, question=question,
                    defaults={'selected_choice': selected_choice}
                )
            attempt.score = round(score, 2)
            attempt.is_completed = True
            attempt.end_time = timezone.now()
            attempt.save()
            return JsonResponse({'message': 'Quiz submitted', 'attempt_id': attempt.id})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    elif request.method == 'GET':
        questions = quiz.questions.prefetch_related('choices').all()
        
        # Calculate remaining time from saved state
        if attempt.time_remaining_seconds is None:
            attempt.time_remaining_seconds = quiz.time_limit * 60
            attempt.save()
            
        remaining_ms = max(0, attempt.time_remaining_seconds * 1000)

        # Load previously saved answers
        saved_answers = {}
        for ua in UserAnswer.objects.filter(attempt=attempt).select_related('selected_choice'):
            saved_answers[str(ua.question_id)] = {
                'choice_id': ua.selected_choice_id,
                'is_marked': ua.is_marked_for_review
            }

        q_data = []
        for q in questions:
            c_data = [{'id': c.id, 'text': c.text} for c in q.choices.all()]
            q_data.append({'id': q.id, 'text': q.text, 'marks': q.marks, 'choices': c_data})

        return JsonResponse({
            'quiz': {
                'id': quiz.id, 'title': quiz.title, 'time_limit': quiz.time_limit,
                'requires_login': quiz.requires_login
            },
            'attempt_id': attempt.id,
            'time_remaining_ms': int(remaining_ms),
            'questions': q_data,
            'saved_answers': saved_answers,
        })

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def save_answer_api(request, quiz_id):
    """Auto-save a single answer during a quiz attempt."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    try:
        quiz = Quiz.objects.get(id=quiz_id, is_published=True)
        
        # Identification
        user = request.user if request.user.is_authenticated else None
        if user:
            attempt = TestAttempt.objects.filter(user=user, quiz=quiz, is_completed=False).first()
        else:
            attempt_id = request.session.get(f'guest_attempt_{quiz_id}')
            attempt = TestAttempt.objects.filter(id=attempt_id, is_completed=False).first() if attempt_id else None

        if not attempt:
            return JsonResponse({'error': 'No active attempt'}, status=404)

        data = json.loads(request.body)
        question = quiz.questions.get(id=data.get('question_id'))
        selected_choice = None
        if data.get('choice_id'):
            selected_choice = Choice.objects.get(id=data['choice_id'], question=question)

        UserAnswer.objects.update_or_create(
            attempt=attempt, question=question,
            defaults={
                'selected_choice': selected_choice,
                'is_marked_for_review': data.get('is_marked_for_review', False)
            }
        )
        return JsonResponse({'saved': True})
    except (Quiz.DoesNotExist, Question.DoesNotExist, Choice.DoesNotExist):
        return JsonResponse({'error': 'Invalid question or choice'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@csrf_exempt
def heartbeat_api(request, quiz_id):
    """Update the remaining time and last heartbeat for an active attempt."""
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        quiz = Quiz.objects.get(id=quiz_id, is_published=True)
        user = request.user if request.user.is_authenticated else None
        
        if user:
            attempt = TestAttempt.objects.filter(user=user, quiz=quiz, is_completed=False).first()
        else:
            attempt_id = request.session.get(f'guest_attempt_{quiz_id}')
            attempt = TestAttempt.objects.filter(id=attempt_id, is_completed=False).first() if attempt_id else None

        if not attempt:
            return JsonResponse({'error': 'No active attempt'}, status=404)

        data = json.loads(request.body)
        remaining = data.get('remaining_seconds')
        
        if remaining is not None:
            attempt.time_remaining_seconds = float(remaining)
            attempt.last_heartbeat = timezone.now()
            attempt.save()
            return JsonResponse({'status': 'ok'})
        
        return JsonResponse({'error': 'Missing remaining_seconds'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


def dashboard_stats_api(request):
    try:
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Unauthorized'}, status=401)
        
        attempts = TestAttempt.objects.filter(user=request.user, is_completed=True).select_related('quiz')
        total = attempts.count()
        
        if total == 0:
            return JsonResponse({'total_attempts': 0, 'average_score_pct': 0, 'pass_rate_pct': 0, 'last_activity': None})

        scores_pct, passed = [], 0
        for a in attempts:
            try:
                # Use getattr for safety if fields are missing in DB
                score = getattr(a, 'score', 0)
                # Calculate total marks for this quiz instance
                tm = sum(getattr(q, 'marks', 1) for q in a.quiz.questions.all())
                
                if tm > 0:
                    pct = (score / tm) * 100
                    scores_pct.append(pct)
                    passing_score = getattr(a.quiz, 'passing_score', 0)
                    if pct >= passing_score:
                        passed += 1
            except Exception as inner_e:
                print(f"Error processing attempt {a.id}: {inner_e}")
                continue

        avg_score = 0
        if scores_pct:
            avg_score = round(sum(scores_pct) / len(scores_pct), 1)

        return JsonResponse({
            'total_attempts': total,
            'average_score_pct': avg_score,
            'pass_rate_pct': round((passed / total) * 100, 1) if total > 0 else 0,
            'last_activity': attempts.first().start_time.isoformat() if total > 0 else None,
        })
    except Exception as e:
        return JsonResponse({'error': f'Dashboard Error: {str(e)}'}, status=500)


def results_list_api(request):
    try:
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Unauthorized'}, status=401)
        data = []
        # Optimization: prefetch_related for questions to avoid N+1
        attempts = TestAttempt.objects.filter(user=request.user, is_completed=True)\
                                      .select_related('quiz')\
                                      .prefetch_related('quiz__questions')\
                                      .order_by('-start_time')
        
        for a in attempts:
            try:
                tm = sum(getattr(q, 'marks', 1) for q in a.quiz.questions.all())
                data.append({
                    'id': a.id, 
                    'quiz_title': getattr(a.quiz, 'title', 'Untitled Quiz'), 
                    'score': getattr(a, 'score', 0) if a.quiz.results_activated else None,
                    'total_marks': tm if a.quiz.results_activated else None, 
                    'start_time': a.start_time.isoformat() if a.start_time else None,
                    'results_activated': getattr(a.quiz, 'results_activated', False),
                })
            except Exception as inner_e:
                print(f"Error in results list item: {inner_e}")
                
        return JsonResponse({'results': data})
    except Exception as e:
        return JsonResponse({'error': f'Results List Error: {str(e)}'}, status=500)


def result_detail_api(request, attempt_id):
    try:
        # Allow anyone to see the detail if they have the attempt ID, 
        # but normally we should check if they are the owner or if it's a guest attempt in their session.
        attempt = TestAttempt.objects.select_related('quiz', 'user').get(id=attempt_id)
        
        # Security: ensure user can only see their own results unless admin
        if attempt.user and request.user != attempt.user and not request.user.is_staff:
             return JsonResponse({'error': 'Unauthorized'}, status=403)
             
        quiz = attempt.quiz
        questions = quiz.questions.prefetch_related('choices').all()
        tm = sum(getattr(q, 'marks', 1) for q in questions)
        
        user_answers = {
            ua.question_id: ua.selected_choice
            for ua in attempt.answers.select_related('selected_choice').all()
        }

        q_data = []
        total_attempted, total_correct, total_wrong, negative_marks = 0, 0, 0, 0.0

        for q in questions:
            try:
                uc = user_answers.get(q.id)
                marks = getattr(q, 'marks', 1)
                if uc:
                    total_attempted += 1
                    if getattr(uc, 'is_correct', False):
                        total_correct += 1
                    else:
                        total_wrong += 1
                        negative_marks += round(float(marks) * quiz.negative_marking, 2)

                is_activated = getattr(quiz, 'results_activated', False)
                if is_activated:
                    awarded_marks, is_wrong = 0.0, False
                    if uc:
                        if getattr(uc, 'is_correct', False):
                            awarded_marks = float(marks)
                        else:
                            awarded_marks = -round(float(marks) * quiz.negative_marking, 2)
                            is_wrong = True

                    c_data = [{'id': c.id, 'text': c.text, 'is_correct': c.is_correct} for c in q.choices.all()]
                    q_data.append({
                        'id': q.id, 'text': q.text, 'marks': marks, 'choices': c_data,
                        'user_choice_id': uc.id if uc else None,
                        'is_correct': getattr(uc, 'is_correct', False) if uc else False,
                        'is_wrong': is_wrong,
                        'awarded_marks': awarded_marks,
                    })
                else:
                    c_data = [{'id': c.id, 'text': c.text} for c in q.choices.all()]
                    q_data.append({
                        'id': q.id, 'text': q.text, 'marks': marks, 'choices': c_data,
                        'user_choice_id': uc.id if uc else None,
                    })
            except Exception as inner_e:
                print(f"Error processing question detail: {inner_e}")

        # Live rank calculation
        higher_scores = TestAttempt.objects.filter(quiz=quiz, score__gt=attempt.score, is_completed=True).count()
        total_participants = TestAttempt.objects.filter(quiz=quiz, is_completed=True).count()
        rank = higher_scores + 1
        pct = round((attempt.score / tm * 100), 1) if tm > 0 else 0

        return JsonResponse({
            'quiz': {'id': quiz.id, 'title': quiz.title},
            'results_activated': is_activated,
            'score': attempt.score, 
            'total_marks': tm, 
            'percentage': pct,
            'rank': rank, 
            'total_participants': total_participants,
            'total_attempted': total_attempted,
            'total_correct': total_correct,
            'total_wrong': total_wrong,
            'negative_marks': round(negative_marks, 2),
            'net_marks': attempt.score,
            'questions': q_data,
            'time_taken_seconds': (attempt.end_time - attempt.start_time).total_seconds() if attempt.end_time and attempt.start_time else 0,
        })
    except TestAttempt.DoesNotExist:
        return JsonResponse({'error': 'Attempt not found'}, status=404)
    except Exception as e:
        print(f"CRITICAL ERROR in result_detail_api: {str(e)}")
        return JsonResponse({'error': f'Detailed Result Error: {str(e)}'}, status=500)