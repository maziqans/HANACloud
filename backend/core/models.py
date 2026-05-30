import os
import shutil
from io import BytesIO
from PIL import Image
from django.core.files.base import ContentFile
from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.conf import settings

def user_directory_path(instance, filename):
    path_parts = [filename]
    curr = instance.parent
    while curr:
        path_parts.insert(0, curr.name)
        curr = curr.parent
    return f'user_{instance.user.username}/{"/".join(path_parts)}'

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    # Default to 50 GB
    storage_limit_bytes = models.BigIntegerField(default=50 * 1024 * 1024 * 1024)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} Profile"

@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)
    else:
        instance.userprofile.save()

import uuid

class CloudFile(models.Model):
    CATEGORY_CHOICES = [
        ('IMAGE', 'Image'),
        ('VIDEO', 'Video'),
        ('DOCUMENT', 'Document'),
        ('FOLDER', 'Folder'),
        ('OTHER', 'Other'),
    ]

    SHARE_MODE_CHOICES = [
        ('RESTRICTED', 'Restricted'),
        ('PUBLIC', 'Public')
    ]

    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='files')
    file = models.FileField(upload_to=user_directory_path, null=True, blank=True)
    name = models.CharField(max_length=255)
    is_folder = models.BooleanField(default=False)
    file_size = models.BigIntegerField(default=0)
    is_trashed = models.BooleanField(default=False)
    is_starred = models.BooleanField(default=False)
    category = models.CharField(max_length=10, choices=CATEGORY_CHOICES, default='OTHER', blank=True, null=True) # Allow null for folders
    updated_at = models.DateTimeField(auto_now=True) # Use auto_now for last modified
    last_viewed_at = models.DateTimeField(null=True, blank=True)
    share_token = models.CharField(max_length=64, unique=True, null=True, blank=True)
    share_mode = models.CharField(max_length=15, choices=SHARE_MODE_CHOICES, default='RESTRICTED')
    thumbnail = models.ImageField(upload_to='thumbnails/', null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'is_trashed', 'parent']),
            models.Index(fields=['user', 'is_trashed', 'is_folder', '-last_viewed_at']),
        ]

    def save(self, *args, **kwargs):
        # Auto-calculate sizes and categories upon save
        is_new = not self.pk
        if is_new and self.file:
            if not self.file_size:
                self.file_size = self.file.size
            if not self.name:
                self.name = os.path.basename(self.file.name)
            
            ext = os.path.splitext(self.name)[1].lower()
            if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                self.category = 'IMAGE'
                
                # Generate highly compressed thumbnail to save massive bandwidth/space
                try:
                    img = Image.open(self.file)
                    img.thumbnail((400, 400)) # Maintain aspect ratio, max 400px
                    if img.mode != 'RGB':
                        img = img.convert('RGB')
                    thumb_io = BytesIO()
                    img.save(thumb_io, format='JPEG', quality=65) # Extremely efficient 65% quality
                    self.thumbnail.save(f"thumb.jpg", ContentFile(thumb_io.getvalue()), save=False)
                except Exception:
                    pass
            elif ext in ['.mp4', '.mov', '.avi', '.mkv', '.webm']:
                self.category = 'VIDEO'
            elif ext in ['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx']:
                self.category = 'DOCUMENT'
            else:
                self.category = 'OTHER'
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

@receiver(post_delete, sender=CloudFile)
def auto_delete_file_on_delete(sender, instance, **kwargs):
    """Physically remove the file or folder from the drive when the database record is deleted."""
    if instance.file and os.path.isfile(instance.file.path):
        os.remove(instance.file.path)
    if instance.thumbnail and os.path.isfile(instance.thumbnail.path):
        os.remove(instance.thumbnail.path)
        
    # Clean up the dynamic WEBP write-through cache for this specific file
    try:
        cache_dir = os.path.join(settings.MEDIA_ROOT, 'thumbnail_cache')
        if os.path.exists(cache_dir):
            for f in os.listdir(cache_dir):
                if f.startswith(f"thumb_{instance.id}_"):
                    os.remove(os.path.join(cache_dir, f))
    except Exception:
        pass
        
    if instance.is_folder:
        path_parts = [instance.name]
        curr = instance.parent
        while curr:
            path_parts.insert(0, curr.name)
            curr = curr.parent
        full_path = os.path.join(settings.MEDIA_ROOT, f'user_{instance.user.username}', *path_parts)
        if os.path.isdir(full_path):
            shutil.rmtree(full_path, ignore_errors=True)

class FileAccess(models.Model):
    ROLE_CHOICES = [('VIEWER', 'Viewer'), ('EDITOR', 'Editor')]
    file = models.ForeignKey(CloudFile, on_delete=models.CASCADE, related_name='access_permissions')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='VIEWER')

    class Meta:
        unique_together = ('file', 'user')

class AccessRequest(models.Model):
    file = models.ForeignKey(CloudFile, on_delete=models.CASCADE, related_name='access_requests')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    status = models.CharField(max_length=10, choices=[('PENDING', 'Pending'), ('APPROVED', 'Approved'), ('REJECTED', 'Rejected')], default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('file', 'user')
