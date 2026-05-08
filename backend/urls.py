"""
URL configuration for core project.
"""
from django.contrib import admin
from django.urls import path
from . import views

urlpatterns = [
    path('admin/', admin.site.urls),
    
    path('api/profile/', views.profile_settings, name='profile_settings'),
    path('api/storage/', views.storage_info, name='storage_info'),
    path('api/storage/request/', views.request_storage, name='request_storage'),
    path('api/account/', views.delete_account, name='delete_account'),
]