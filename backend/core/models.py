import os
import shutil
from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.conf import settings

def user_directory_path(instance, filename):
    path_parts = [filename]
    curr = instance.parent
    while curr:
        path_parts.insert(0, curr.name)
        curr = curr.parent
    return f'user_{instance.user.username}/{"/".join(path_parts)}'

class CloudFile(models.Model):
    CATEGORY_CHOICES = [
        ('IMAGE', 'Image'),
        ('VIDEO', 'Video'),
        ('DOCUMENT', 'Document'),
        ('FOLDER', 'Folder'),
        ('OTHER', 'Other'),
    ]

    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='files')
    file = models.FileField(upload_to=user_directory_path, null=True, blank=True)
    name = models.CharField(max_length=255)
    is_folder = models.BooleanField(default=False)
    file_size = models.BigIntegerField(default=0)
    is_trashed = models.BooleanField(default=False)
    category = models.CharField(max_length=10, choices=CATEGORY_CHOICES, default='OTHER', blank=True, null=True) # Allow null for folders
    updated_at = models.DateTimeField(auto_now=True) # Use auto_now for last modified

    def save(self, *args, **kwargs):
        # Auto-calculate sizes and categories upon save
        if self.file:
            self.file_size = self.file.size
            self.name = self.file.name
            
            ext = os.path.splitext(self.name)[1].lower()
            if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                self.category = 'IMAGE'
            elif ext in ['.mp4', '.mov', '.avi', '.mkv']:
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
    if instance.is_folder:
        path_parts = [instance.name]
        curr = instance.parent
        while curr:
            path_parts.insert(0, curr.name)
            curr = curr.parent
        full_path = os.path.join(settings.MEDIA_ROOT, f'user_{instance.user.username}', *path_parts)
        if os.path.isdir(full_path):
            shutil.rmtree(full_path, ignore_errors=True)
