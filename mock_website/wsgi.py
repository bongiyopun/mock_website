"""
WSGI config for mock_website project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/


import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mock_website.settings')

application = get_wsgi_application()

"""
import os
from django.core.wsgi import get_wsgi_application
from django.core.management import call_command

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mock_website.settings')

# Automatically run migrations and create a default superuser on startup
try:
    call_command('migrate')
    
    from django.contrib.auth import get_user_model
    User = get_user_model()
    if not User.objects.filter(username='admin').exists():
        User.objects.create_superuser('admin', 'admin@example.com', 'admin12345')
        print("Superuser 'admin' created successfully!")
except Exception as e:
    print(f"Startup setup error: {e}")

application = get_wsgi_application()
