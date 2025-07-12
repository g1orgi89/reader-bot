function showLoading(containerId, message = 'Загрузка...') {
    const container = containerId === 'prompts-table' ? 
        document.querySelector('#prompts-table tbody') : 
        document.getElementById(containerId);
    
    if (container) {
        if (containerId === 'prompts-table') {
            container.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">${message}</td></tr>`;
        } else {
            container.innerHTML = `<div class="text-center text-muted py-4">${message}</div>`;
        }
    }
}