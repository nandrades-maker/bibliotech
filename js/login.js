Auth.redirectIfLoggedIn();

    const form     = document.getElementById('login-form');
    const alertBox = document.getElementById('login-alert');
    const alertMsg = document.getElementById('login-alert-msg');
    const loginBtn = document.getElementById('login-btn');
    const togglePw = document.getElementById('toggle-pw');
    const pwInput  = document.getElementById('password');

    // Mostrar / ocultar contraseña
    togglePw.addEventListener('click', () => {
      const visible = pwInput.type === 'text';
      pwInput.type = visible ? 'password' : 'text';
      togglePw.textContent = visible ? '👁' : '🙈';
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      alertBox.classList.remove('show');

      // Validación básica
      let valid = true;
      ['fg-usuario', 'fg-password'].forEach(id => {
        const fg = document.getElementById(id);
        const inp = fg.querySelector('input');
        if (!inp.value.trim()) {
          fg.classList.add('has-error');
          inp.classList.add('error');
          valid = false;
        } else {
          fg.classList.remove('has-error');
          inp.classList.remove('error');
        }
      });
      if (!valid) return;

      const creds = {
        usuario:  document.getElementById('usuario').value.trim(),
        password: pwInput.value,
      };

      loginBtn.classList.add('loading');
      loginBtn.disabled = true;

      try {
    const autenticado = await API.Login.authenticate(creds);

    if (!autenticado) {
        throw new Error('Usuario o contraseña incorrectos');
    }

    Auth.save(creds.usuario);
    window.location.href = 'dashboard.html';

} catch (err) {
    alertMsg.textContent = err.message || 'Credenciales incorrectas. Intenta de nuevo.';
    alertBox.classList.add('show');
    loginBtn.classList.remove('loading');
    loginBtn.disabled = false;
}
    });