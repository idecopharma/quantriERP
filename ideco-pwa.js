(function initializeInstallation() {
  const status = document.getElementById('install-status');
  const button = document.getElementById('install-app');
  let launchVerified = false;
  let installPrompt;
  if (status && button) {
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      installPrompt = event;
      button.hidden = !launchVerified;
    });
    button.addEventListener('click', async () => {
      const prompt = installPrompt;
      if (!prompt) return;
      installPrompt = null;
      button.hidden = true;
      try {
        await prompt.prompt();
      } catch {
        status.textContent = 'Hãy dùng mục cài ứng dụng trong menu Chrome.';
      }
    });
    window.addEventListener('appinstalled', () => {
      button.hidden = true;
      status.textContent = 'Đã thêm ứng dụng lên màn hình chính.';
    });
  }

  if (!window.isSecureContext || location.protocol === 'file:') {
    if (status) status.textContent = 'Hãy tải toàn bộ bộ cài lên website HTTPS rồi mở lại trang này từ website.';
    return;
  }

  const worker = 'serviceWorker' in navigator
    ? navigator.serviceWorker.register(new URL('./sw.js', document.currentScript.src), {updateViaCache:'none'})
    : null;
  if (worker) worker.catch(error => console.warn('PWA:', error.message));
  if (!status) return;

  (async () => {
    const manifestUrl = document.querySelector('link[rel="manifest"]').href;
    const response = await fetch(manifestUrl, {cache:'no-cache'});
    if (!response.ok) throw new Error('manifest.json trả về HTTP ' + response.status);
    const manifest = await response.json().catch(() => {
      throw new Error('manifest.json không phải JSON hợp lệ.');
    });
    const startUrl = new URL(manifest.start_url || './index.html', manifestUrl);
    const scopeUrl = new URL(manifest.scope || './', manifestUrl);
    if (startUrl.origin !== location.origin || scopeUrl.origin !== location.origin ||
        !startUrl.pathname.startsWith(scopeUrl.pathname)) {
      throw new Error('Đường dẫn mở app nằm ngoài website hoặc phạm vi cài đặt.');
    }
    const launch = await fetch(startUrl, {cache:'no-cache'});
    if (!launch.ok) throw new Error('Không mở được index.html, HTTP ' + launch.status);
    const finalUrl = new URL(launch.url || startUrl.href);
    if (finalUrl.origin !== startUrl.origin || finalUrl.pathname !== startUrl.pathname) {
      throw new Error('index.html chuyển sang địa chỉ khác. Kiểm tra lại GitHub Pages.');
    }
    const contentType = launch.headers.get('content-type')?.toLowerCase() || '';
    if (!contentType.includes('text/html')) {
      throw new Error('index.html chưa được website phục vụ dưới dạng HTML.');
    }
    const openLink = document.getElementById('open-app');
    if (openLink) openLink.href = startUrl.href;
    const icons = manifest.icons || [];
    for (const size of [192, 512]) {
      if (!icons.some(icon => icon.sizes === size + 'x' + size && icon.purpose === 'any')) {
        throw new Error('Manifest thiếu logo ' + size + ' × ' + size + '.');
      }
    }
    const imageUrls = icons.map(icon => [new URL(icon.src, manifestUrl).href, Number(icon.sizes.split('x')[0])]);
    imageUrls.push([document.querySelector('link[rel="apple-touch-icon"]').href, 180]);
    await Promise.all(imageUrls.map(async ([url, size]) => {
      const image = new Image();
      image.src = url;
      const filename = new URL(url).pathname.split('/').pop();
      try { await image.decode(); } catch { throw new Error('Không tải được logo ' + filename); }
      if (image.naturalWidth !== size || image.naturalHeight !== size) {
        throw new Error('Logo sai kích thước: ' + filename);
      }
    }));
    if (worker) await worker.catch(error => { throw new Error('Không đăng ký được sw.js: ' + error.message); });
    launchVerified = true;
    if (button) button.hidden = !installPrompt;
    status.textContent = 'Đã kiểm tra index.html, manifest và logo. Bấm Mở ứng dụng để thử trước, sau đó cài từ trang ứng dụng.';
  })().catch(error => {
    status.textContent = 'Kiểm tra bộ cài: ' + error.message + ' Kiểm tra đã tải đủ các tệp cùng cấp trên website.';
  });
})();
