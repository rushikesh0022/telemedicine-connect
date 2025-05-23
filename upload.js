document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('fileInput');
    const uploadButton = document.getElementById('uploadButton');
    const statusMessage = document.getElementById('statusMessage');

    uploadButton.addEventListener('click', async function() {
        if (fileInput.files.length === 0) {
            showStatus('No file selected.', 'error');
            return;
        }
        
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch('http://localhost:3000/upload', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                showStatus('File uploaded successfully!', 'success');
            } else {
                showStatus('Upload failed. Try again.', 'error');
            }
        } catch (error) {
            showStatus('Network error. Check your connection.', 'error');
        }
    });

    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = type;
    }
});
