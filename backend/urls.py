"""
URL configuration for core project.
"""
from django.contrib import admin
from django.urls import path
import views
from rest_framework_simplejwt.views import TokenObtainPairView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/users/me/', views.current_user, name='current_user'),
    
    path('api/drive/', views.drive_items, name='drive_items'),
    path('api/drive/<int:item_id>/', views.move_to_trash, name='move_to_trash'),
    path('api/upload/', views.upload_files, name='upload_files'),
    path('api/download/<int:file_id>/', views.download_file, name='download_file'),
    
    path('api/profile/', views.profile_settings, name='profile_settings'),
    path('api/storage/summary/', views.storage_summary, name='storage_summary'),
    path('api/storage/request/', views.request_storage, name='request_storage'),
    path('api/account/', views.delete_account, name='delete_account'),
]