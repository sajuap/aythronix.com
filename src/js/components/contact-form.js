/**
 * Contact form.
 *
 * The reference posts to its hosting platform's form endpoint, which does not
 * exist here. This keeps the same three visual states — idle, "Please wait...",
 * then the success or failure panel — and posts to whatever `action` the markup
 * declares. With no `action` set it validates, shows the success panel and
 * clears, so the interaction is complete and reviewable without a backend.
 *
 * Wire a real endpoint by setting `action` (and `method`) on the <form>.
 */

export function initContactForm() {
  const form = document.querySelector('[data-contact-form]');
  if (!form) return;

  const submit = form.querySelector('[type="submit"]');
  const doneEl = document.querySelector('[data-form-done]');
  const failEl = document.querySelector('[data-form-fail]');

  const idleLabel = submit ? submit.value || submit.textContent : '';
  const waitLabel = submit?.dataset.wait || 'Please wait...';

  const setState = (state) => {
    doneEl?.classList.toggle('is-visible', state === 'done');
    failEl?.classList.toggle('is-visible', state === 'fail');
    form.style.display = state === 'done' ? 'none' : '';
  };

  const setBusy = (busy) => {
    if (!submit) return;
    submit.disabled = busy;
    const label = busy ? waitLabel : idleLabel;
    if ('value' in submit && submit.tagName === 'INPUT') submit.value = label;
    else submit.textContent = label;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Let the browser do the validating and surface its own messages.
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    setState('idle');
    setBusy(true);

    const action = form.getAttribute('action');

    // No endpoint configured — treat as success so the flow stays testable.
    if (!action) {
      setTimeout(() => {
        setBusy(false);
        setState('done');
        form.reset();
      }, 600);
      return;
    }

    try {
      const response = await fetch(action, {
        method: (form.getAttribute('method') || 'POST').toUpperCase(),
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });

      setBusy(false);

      if (response.ok) {
        setState('done');
        form.reset();
      } else {
        setState('fail');
      }
    } catch {
      setBusy(false);
      setState('fail');
    }
  });
}
