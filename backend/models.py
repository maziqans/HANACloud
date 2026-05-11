import os
from django.db import models
from django.contrib.auth.models import User

def user_directory_path(instance, filename):
    # Files will be uploaded to: /app/storage/user_<id>/<filename>
    return f'user_{instance.user.id}/{filename}'

class CloudFile(models.Model):
    CATEGORY_CHOICES = [
        ('IMAGE', 'Image'),
        ('VIDEO', 'Video'),
        ('DOCUMENT', 'Document'),
        ('OTHER', 'Other'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='files')
    file = models.FileField(upload_to=user_directory_path)
    name = models.CharField(max_length=255)
    file_size = models.BigIntegerField(default=0)
    category = models.CharField(max_length=10, choices=CATEGORY_CHOICES, default='OTHER')
    uploaded_at = models.DateTimeField(auto_now_add=True)

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