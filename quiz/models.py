from django.db import models
from django.contrib.auth.models import User


class Quiz(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    time_limit = models.PositiveIntegerField(help_text="Time limit in minutes.")
    passing_score = models.PositiveIntegerField(default=0, help_text="Required percentage score to pass.")
    results_activated = models.BooleanField(default=False, help_text="If false, users cannot see their results/rank.")
    negative_marking = models.FloatField(
        default=0.0,
        help_text="Fraction of marks deducted for wrong answers (e.g. 0.33 = 1/3 deduction, 0 = no penalty)."
    )
    DIFFICULTY_CHOICES = [
        ('Easy', 'Easy'),
        ('Medium', 'Medium'),
        ('Hard', 'Hard'),
    ]
    difficulty = models.CharField(max_length=10, choices=DIFFICULTY_CHOICES, default='Medium')
    is_published = models.BooleanField(default=False)
    requires_login = models.BooleanField(default=True, help_text="If false, guests can take this test without an account.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Quizzes"
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class Question(models.Model):
    quiz = models.ForeignKey(Quiz, related_name='questions', on_delete=models.CASCADE)
    text = models.TextField()
    image = models.ImageField(upload_to='question_images/', blank=True, null=True,
                              help_text="Optional image to accompany the question.")
    marks = models.PositiveIntegerField(default=1)

    def __str__(self):
        return f"{self.quiz.title} — {self.text[:60]}"


class Choice(models.Model):
    question = models.ForeignKey(Question, related_name='choices', on_delete=models.CASCADE)
    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return f"{'✓' if self.is_correct else '✗'} {self.text}"


class TestAttempt(models.Model):
    user = models.ForeignKey(User, related_name='attempts', on_delete=models.CASCADE, null=True, blank=True)
    quiz = models.ForeignKey(Quiz, related_name='attempts', on_delete=models.CASCADE)
    score = models.FloatField(default=0.0)
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    is_completed = models.BooleanField(default=False)
    time_remaining_seconds = models.FloatField(
        null=True, blank=True,
        help_text="Remaining time in seconds. Set on creation, updated on each heartbeat."
    )
    last_heartbeat = models.DateTimeField(
        null=True, blank=True,
        help_text="Last time the user was actively taking this test."
    )

    class Meta:
        ordering = ['-start_time']

    def __str__(self):
        username = self.user.username if self.user else "Guest"
        return f"{username} — {self.quiz.title} ({self.score})"


class UserAnswer(models.Model):
    """Stores each individual answer submitted by a user during a test attempt."""
    attempt = models.ForeignKey(TestAttempt, related_name='answers', on_delete=models.CASCADE)
    question = models.ForeignKey(Question, related_name='user_answers', on_delete=models.CASCADE)
    selected_choice = models.ForeignKey(Choice, null=True, blank=True,
                                        on_delete=models.SET_NULL, related_name='user_answers')
    is_marked_for_review = models.BooleanField(default=False)

    class Meta:
        unique_together = ('attempt', 'question')

    def __str__(self):
        username = self.attempt.user.username if self.attempt.user else 'Guest'
        return f"{username} — Q{self.question.id}: {self.selected_choice}"