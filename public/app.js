const PLACEHOLDER_IMAGE = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480"><rect width="640" height="480" fill="#f5d5ba"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#8f4216" font-family="Trebuchet MS, sans-serif" font-size="34">Product image</text></svg>'
)}`;

const state = {
  products: [],
  loading: true,
  isSaving: false,
  deletingId: '',
  editingProductId: '',
};

const elements = {};

document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  attachEventListeners();
  loadProducts();
});

function cacheElements() {
  [
    'openCreateButton',
    'openEmptyStateButton',
    'catalogSummary',
    'feedback',
    'loadingState',
    'emptyState',
    'productGrid',
    'productModal',
    'closeModalButton',
    'cancelButton',
    'productForm',
    'modalTitle',
    'nameInput',
    'priceInput',
    'imageUrlInput',
    'formError',
    'submitButton',
    'previewImage',
    'previewName',
    'previewPrice',
  ].forEach((id) => {
    elements[id] = document.getElementById(id);
  });
}

function attachEventListeners() {
  elements.openCreateButton.addEventListener('click', () => openModal());
  elements.openEmptyStateButton.addEventListener('click', () => openModal());
  elements.closeModalButton.addEventListener('click', closeModal);
  elements.cancelButton.addEventListener('click', closeModal);
  elements.productModal.addEventListener('click', handleModalClick);
  elements.productForm.addEventListener('submit', handleSubmit);
  elements.productGrid.addEventListener('click', handleProductAction);
  elements.nameInput.addEventListener('input', syncPreview);
  elements.priceInput.addEventListener('input', syncPreview);
  elements.imageUrlInput.addEventListener('input', syncPreview);
  elements.previewImage.addEventListener('error', () => {
    elements.previewImage.src = PLACEHOLDER_IMAGE;
  });
  document.addEventListener('keydown', handleEscapeKey);
}

async function loadProducts() {
  state.loading = true;
  render();

  try {
    state.products = await apiFetch('/products');
    clearFeedback();
  } catch (error) {
    showFeedback(getErrorMessage(error), true);
  } finally {
    state.loading = false;
    render();
  }
}

function render() {
  const isEmpty = !state.loading && state.products.length === 0;
  elements.catalogSummary.textContent = state.loading
    ? 'Loading products...'
    : `${state.products.length} product${state.products.length === 1 ? '' : 's'} available`;

  elements.loadingState.classList.toggle('hidden', !state.loading);
  elements.emptyState.classList.toggle('hidden', !isEmpty);
  elements.productGrid.classList.toggle(
    'hidden',
    state.loading || state.products.length === 0
  );

  elements.submitButton.textContent = state.isSaving
    ? state.editingProductId
      ? 'Saving...'
      : 'Adding...'
    : state.editingProductId
      ? 'Save Changes'
      : 'Save Product';
  elements.submitButton.disabled = state.isSaving;
  elements.openCreateButton.disabled = state.isSaving;

  renderProducts();
}

function renderProducts() {
  if (state.loading || state.products.length === 0) {
    elements.productGrid.innerHTML = '';
    return;
  }

  elements.productGrid.innerHTML = state.products
    .map((product) => {
      const isDeleting = state.deletingId === product.id;
      return `
        <article class="product-card">
          <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" data-fallback-image="true" />
          <div class="product-body">
            <div class="product-copy">
              <h3 class="product-name">${escapeHtml(product.name)}</h3>
              <p class="product-price">${formatPrice(product.price)}</p>
            </div>
            <div class="product-actions">
              <button class="product-action" type="button" data-action="edit" data-id="${product.id}" ${
                state.isSaving ? 'disabled' : ''
              }>
                Edit
              </button>
              <button class="product-action delete" type="button" data-action="delete" data-id="${product.id}" ${
                isDeleting ? 'disabled' : ''
              }>
                ${isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  elements.productGrid.querySelectorAll('[data-fallback-image="true"]').forEach((image) => {
    image.addEventListener(
      'error',
      () => {
        image.src = PLACEHOLDER_IMAGE;
      },
      { once: true }
    );
  });
}

function openModal(product = null) {
  state.editingProductId = product?.id || '';
  elements.modalTitle.textContent = product ? 'Edit Product' : 'Add Product';
  elements.nameInput.value = product?.name || '';
  elements.priceInput.value = product?.price ?? '';
  elements.imageUrlInput.value = product?.imageUrl || '';
  clearFormError();
  syncPreview();
  elements.productModal.classList.remove('hidden');
  elements.productModal.setAttribute('aria-hidden', 'false');
  elements.nameInput.focus();
  render();
}

function closeModal(force = false) {
  if (state.isSaving && !force) {
    return;
  }

  state.editingProductId = '';
  elements.productForm.reset();
  clearFormError();
  syncPreview();
  elements.productModal.classList.add('hidden');
  elements.productModal.setAttribute('aria-hidden', 'true');
  render();
}

function handleModalClick(event) {
  if (event.target.dataset.closeModal === 'true') {
    closeModal();
  }
}

function handleEscapeKey(event) {
  if (event.key === 'Escape' && !elements.productModal.classList.contains('hidden')) {
    closeModal();
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const payload = getValidatedFormValues();
  if (!payload) {
    return;
  }

  state.isSaving = true;
  render();

  try {
    if (state.editingProductId) {
      const updatedProduct = await apiFetch(`/products/${state.editingProductId}`, {
        method: 'PUT',
        body: payload,
      });

      state.products = state.products.map((product) =>
        product.id === updatedProduct.id ? updatedProduct : product
      );
      showFeedback(`Updated "${updatedProduct.name}".`);
    } else {
      const createdProduct = await apiFetch('/products', {
        method: 'POST',
        body: payload,
      });

      state.products = [createdProduct, ...state.products];
      showFeedback(`Added "${createdProduct.name}".`);
    }

    closeModal(true);
  } catch (error) {
    showFormError(getErrorMessage(error));
  } finally {
    state.isSaving = false;
    render();
  }
}

async function handleProductAction(event) {
  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) {
    return;
  }

  const product = state.products.find((item) => item.id === actionButton.dataset.id);
  if (!product) {
    return;
  }

  if (actionButton.dataset.action === 'edit') {
    openModal(product);
    return;
  }

  const shouldDelete = window.confirm(`Delete "${product.name}"?`);
  if (!shouldDelete) {
    return;
  }

  state.deletingId = product.id;
  render();

  try {
    await apiFetch(`/products/${product.id}`, { method: 'DELETE' });
    state.products = state.products.filter((item) => item.id !== product.id);
    showFeedback(`Deleted "${product.name}".`);
  } catch (error) {
    showFeedback(getErrorMessage(error), true);
  } finally {
    state.deletingId = '';
    render();
  }
}

function getValidatedFormValues() {
  const name = elements.nameInput.value.trim();
  const imageUrl = elements.imageUrlInput.value.trim();
  const price = Number(elements.priceInput.value);

  if (!name) {
    showFormError('Name is required.');
    return null;
  }

  if (!Number.isFinite(price) || price <= 0) {
    showFormError('Price must be a positive number.');
    return null;
  }

  if (!imageUrl) {
    showFormError('Image URL is required.');
    return null;
  }

  clearFormError();

  return {
    name,
    price,
    imageUrl,
  };
}

function syncPreview() {
  const name = elements.nameInput.value.trim() || 'Product name';
  const parsedPrice = Number(elements.priceInput.value);
  const imageUrl = elements.imageUrlInput.value.trim() || PLACEHOLDER_IMAGE;

  elements.previewName.textContent = name;
  elements.previewPrice.textContent =
    Number.isFinite(parsedPrice) && parsedPrice > 0
      ? formatPrice(parsedPrice)
      : '$0.00';
  elements.previewImage.src = imageUrl;
}

async function apiFetch(pathname, options = {}) {
  const response = await fetch(pathname, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(data?.error || 'Something went wrong.');
    error.status = response.status;
    throw error;
  }

  return data;
}

function showFeedback(message, isError = false) {
  elements.feedback.textContent = message;
  elements.feedback.className = `feedback ${isError ? 'error' : 'success'}`;
}

function clearFeedback() {
  elements.feedback.textContent = '';
  elements.feedback.className = 'feedback hidden';
}

function showFormError(message) {
  elements.formError.textContent = message;
  elements.formError.classList.remove('hidden');
}

function clearFormError() {
  elements.formError.textContent = '';
  elements.formError.classList.add('hidden');
}

function getErrorMessage(error) {
  return error?.message || 'Something went wrong.';
}

function formatPrice(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
