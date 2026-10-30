from django.urls import path
from . import views

urlpatterns = [
    path('', views.spa_view, name='spa'),
    path('api/register/', views.register_api, name='api_register'),
    path('api/login/', views.login_api, name='api_login'),
    path('api/logout/', views.logout_api, name='api_logout'),
    path('api/me/', views.me_api, name='api_me'),
    path('api/home_quiz/', views.home_quiz_api, name='api_home_quiz'),
    path('api/quizzes/', views.quizzes_api, name='api_quizzes'),
    path('api/quizzes/<int:quiz_id>/', views.quiz_detail_api, name='api_quiz_detail'),
    path('api/quizzes/<int:quiz_id>/attempt/', views.attempt_quiz_api, name='api_attempt_quiz'),
    path('api/quizzes/<int:quiz_id>/save_answer/', views.save_answer_api, name='api_save_answer'),
    path('api/quizzes/<int:quiz_id>/heartbeat/', views.heartbeat_api, name='api_heartbeat'),
    path('api/results/', views.results_list_api, name='api_results_list'),
    path('api/results/<int:attempt_id>/', views.result_detail_api, name='api_result_detail'),
    path('api/stats/', views.dashboard_stats_api, name='api_stats'),
]