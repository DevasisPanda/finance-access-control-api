const SAMPLE_USERS = {
  admin: { email: 'admin@finance.local', password: 'Admin@123' },
  analyst: { email: 'analyst@finance.local', password: 'Analyst@123' },
  viewer: { email: 'viewer@finance.local', password: 'Viewer@123' },
};

const state = {
  token: localStorage.getItem('finance_token') || '',
  user: null,
  currentTab: 'dashboard',
  dashboardFilters: {
    from: '',
    to: '',
    groupBy: 'month',
    limit: '5',
  },
  recordFilters: {
    page: 1,
    pageSize: 10,
    type: '',
    category: '',
    search: '',
    from: '',
    to: '',
    includeDeleted: false,
  },
  dashboard: null,
  records: [],
  recordMeta: null,
  users: [],
  editingRecordId: null,
};

const elements = {};

document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  attachEventListeners();
  restoreSession();
});

function cacheElements() {
  [
    'authPanel',
    'workspace',
    'loginForm',
    'emailInput',
    'passwordInput',
    'refreshButton',
    'logoutButton',
    'sessionHeading',
    'sessionPill',
    'dashboardFilterForm',
    'dashboardFrom',
    'dashboardTo',
    'dashboardGroupBy',
    'dashboardLimit',
    'totalIncomeValue',
    'totalExpensesValue',
    'netBalanceValue',
    'totalRecordsValue',
    'categoryTableBody',
    'recentTableBody',
    'trendTableBody',
    'recordFilterForm',
    'recordTypeFilter',
    'recordCategoryFilter',
    'recordSearchFilter',
    'recordFromFilter',
    'recordToFilter',
    'recordPageSizeFilter',
    'includeDeletedFilter',
    'includeDeletedField',
    'recordPrevPage',
    'recordNextPage',
    'recordPaginationLabel',
    'recordTableBody',
    'recordForm',
    'recordFormTitle',
    'recordAmountInput',
    'recordTypeInput',
    'recordCategoryInput',
    'recordDateInput',
    'recordNotesInput',
    'recordSubmitButton',
    'recordResetButton',
    'recordEditorCard',
    'userForm',
    'userNameInput',
    'userEmailInput',
    'userPasswordInput',
    'userRoleInput',
    'userStatusInput',
    'userTableBody',
    'toast',
    'dashboardPanel',
    'recordsPanel',
    'usersPanel',
    'docsPanel',
  ].forEach((id) => {
    elements[id] = document.getElementById(id);
  });

  elements.tabButtons = Array.from(document.querySelectorAll('.tab-button'));
  elements.sampleButtons = Array.from(document.querySelectorAll('[data-sample]'));
}

function attachEventListeners() {
  elements.loginForm.addEventListener('submit', handleLogin);
  elements.refreshButton.addEventListener('click', loadAllVisibleData);
  elements.logoutButton.addEventListener('click', handleLogout);
  elements.dashboardFilterForm.addEventListener('submit', handleDashboardFilters);
  elements.recordFilterForm.addEventListener('submit', handleRecordFilters);
  elements.recordPrevPage.addEventListener('click', () => changeRecordPage(-1));
  elements.recordNextPage.addEventListener('click', () => changeRecordPage(1));
  elements.recordForm.addEventListener('submit', handleRecordSubmit);
  elements.recordResetButton.addEventListener('click', resetRecordForm);
  elements.recordTableBody.addEventListener('click', handleRecordTableAction);
  elements.userForm.addEventListener('submit', handleUserCreate);
  elements.userTableBody.addEventListener('click', handleUserTableAction);
  elements.tabButtons.forEach((button) =>
    button.addEventListener('click', () => activateTab(button.dataset.tab))
  );
  elements.sampleButtons.forEach((button) =>
    button.addEventListener('click', () => fillSample(button.dataset.sample))
  );
}

async function restoreSession() {
  if (!state.token) {
    renderSession();
    return;
  }

  try {
    const response = await apiFetch('/auth/me');
    state.user = response.data;
    renderSession();
    await loadAllVisibleData();
  } catch (error) {
    clearSession();
    renderSession();
  }
}

function fillSample(role) {
  const credentials = SAMPLE_USERS[role];
  if (!credentials) {
    return;
  }

  elements.emailInput.value = credentials.email;
  elements.passwordInput.value = credentials.password;
}

async function handleLogin(event) {
  event.preventDefault();

  try {
    const response = await apiFetch('/auth/login', {
      method: 'POST',
      body: {
        email: elements.emailInput.value,
        password: elements.passwordInput.value,
      },
    });

    state.token = response.data.token;
    state.user = response.data.user;
    localStorage.setItem('finance_token', state.token);
    elements.passwordInput.value = '';
    renderSession();
    await loadAllVisibleData();
    notify(`Signed in as ${state.user.name}.`);
  } catch (error) {
    notify(getErrorMessage(error), true);
  }
}

async function handleLogout() {
  try {
    if (state.token) {
      await apiFetch('/auth/logout', { method: 'POST' });
    }
  } catch (error) {
    notify(getErrorMessage(error), true);
  } finally {
    clearSession();
    renderSession();
  }
}

function clearSession() {
  state.token = '';
  state.user = null;
  state.dashboard = null;
  state.records = [];
  state.recordMeta = null;
  state.users = [];
  state.editingRecordId = null;
  localStorage.removeItem('finance_token');
}

function renderSession() {
  const signedIn = Boolean(state.user);
  elements.authPanel.classList.toggle('hidden', signedIn);
  elements.workspace.classList.toggle('hidden', !signedIn);

  if (!signedIn) {
    return;
  }

  elements.sessionHeading.textContent = state.user.name;
  elements.sessionPill.textContent = `${state.user.role} / ${state.user.status}`;
  elements.includeDeletedField.classList.toggle('hidden', state.user.role !== 'admin');
  elements.recordEditorCard.classList.toggle('hidden', state.user.role !== 'admin');

  const viewersOnly = state.user.role === 'viewer';
  const adminOnly = state.user.role !== 'admin';

  setTabVisibility('records', !viewersOnly);
  setTabVisibility('users', !adminOnly);
  setTabVisibility('docs', true);
  setTabVisibility('dashboard', true);

  if (viewersOnly && state.currentTab !== 'dashboard' && state.currentTab !== 'docs') {
    activateTab('dashboard');
  } else if (adminOnly && state.currentTab === 'users') {
    activateTab('dashboard');
  } else {
    activateTab(state.currentTab);
  }
}

function setTabVisibility(tabName, visible) {
  const button = elements.tabButtons.find((entry) => entry.dataset.tab === tabName);
  if (button) {
    button.classList.toggle('hidden', !visible);
  }
}

function activateTab(tabName) {
  state.currentTab = tabName;
  const panelMap = {
    dashboard: elements.dashboardPanel,
    records: elements.recordsPanel,
    users: elements.usersPanel,
    docs: elements.docsPanel,
  };

  elements.tabButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tabName);
  });

  Object.entries(panelMap).forEach(([name, panel]) => {
    panel.classList.toggle('hidden', name !== tabName);
  });
}

async function loadAllVisibleData() {
  if (!state.user) {
    return;
  }

  try {
    await loadDashboard();
    if (state.user.role === 'analyst' || state.user.role === 'admin') {
      await loadRecords();
    }
    if (state.user.role === 'admin') {
      await loadUsers();
    }
  } catch (error) {
    notify(getErrorMessage(error), true);
  }
}

async function loadDashboard() {
  syncDashboardFiltersFromInputs();
  const params = new URLSearchParams();
  appendIfPresent(params, 'from', state.dashboardFilters.from);
  appendIfPresent(params, 'to', state.dashboardFilters.to);
  appendIfPresent(params, 'groupBy', state.dashboardFilters.groupBy);
  appendIfPresent(params, 'limit', state.dashboardFilters.limit);

  const response = await apiFetch(`/dashboard/overview?${params.toString()}`);
  state.dashboard = response.data;
  renderDashboard();
}

function renderDashboard() {
  if (!state.dashboard) {
    return;
  }

  const { totals, categoryBreakdown, recentActivity, trends } = state.dashboard;
  elements.totalIncomeValue.textContent = formatCurrency(totals.totalIncome);
  elements.totalExpensesValue.textContent = formatCurrency(totals.totalExpenses);
  elements.netBalanceValue.textContent = formatCurrency(totals.netBalance);
  elements.totalRecordsValue.textContent = String(totals.totalRecords);

  renderRows(
    elements.categoryTableBody,
    categoryBreakdown,
    (row) => `
      <tr>
        <td>${escapeHtml(row.category)}</td>
        <td>${formatCurrency(row.income)}</td>
        <td>${formatCurrency(row.expenses)}</td>
        <td>${formatCurrency(row.net)}</td>
      </tr>
    `,
    4,
    'No categories found for the selected filters.'
  );

  renderRows(
    elements.recentTableBody,
    recentActivity,
    (row) => `
      <tr>
        <td>${escapeHtml(row.entryDate)}</td>
        <td>${escapeHtml(row.type)}</td>
        <td>${escapeHtml(row.category)}</td>
        <td>${formatCurrency(row.amount)}</td>
      </tr>
    `,
    4,
    'No recent activity found.'
  );

  renderRows(
    elements.trendTableBody,
    trends,
    (row) => `
      <tr>
        <td>${escapeHtml(row.period)}</td>
        <td>${formatCurrency(row.income)}</td>
        <td>${formatCurrency(row.expenses)}</td>
        <td>${formatCurrency(row.net)}</td>
      </tr>
    `,
    4,
    'No trend data found.'
  );
}

async function loadRecords() {
  syncRecordFiltersFromInputs();
  const params = new URLSearchParams();
  appendIfPresent(params, 'page', state.recordFilters.page);
  appendIfPresent(params, 'pageSize', state.recordFilters.pageSize);
  appendIfPresent(params, 'type', state.recordFilters.type);
  appendIfPresent(params, 'category', state.recordFilters.category);
  appendIfPresent(params, 'search', state.recordFilters.search);
  appendIfPresent(params, 'from', state.recordFilters.from);
  appendIfPresent(params, 'to', state.recordFilters.to);
  if (state.recordFilters.includeDeleted) {
    params.set('includeDeleted', 'true');
  }

  const response = await apiFetch(`/records?${params.toString()}`);
  state.records = response.data;
  state.recordMeta = response.meta;
  renderRecords();
}

function renderRecords() {
  elements.recordPaginationLabel.textContent = state.recordMeta
    ? `Page ${state.recordMeta.page} of ${state.recordMeta.totalPages}`
    : 'Page 1';

  renderRows(
    elements.recordTableBody,
    state.records,
    (row) => {
      const actionButtons =
        state.user.role === 'admin'
          ? row.isDeleted
            ? `<button class="secondary-button" data-action="restore" data-id="${row.id}" type="button">Restore</button>`
            : `
              <button class="secondary-button" data-action="edit" data-id="${row.id}" type="button">Edit</button>
              <button class="danger-button" data-action="delete" data-id="${row.id}" type="button">Delete</button>
            `
          : '<span class="status-pill">Read only</span>';

      return `
        <tr>
          <td>${escapeHtml(row.entryDate)}</td>
          <td>${escapeHtml(row.type)}</td>
          <td>${escapeHtml(row.category)}</td>
          <td>${formatCurrency(row.amount)}</td>
          <td>${row.isDeleted ? 'Deleted' : 'Active'}</td>
          <td><div class="row-actions">${actionButtons}</div></td>
        </tr>
      `;
    },
    6,
    'No records found.'
  );

  elements.recordPrevPage.disabled = !state.recordMeta || state.recordMeta.page <= 1;
  elements.recordNextPage.disabled =
    !state.recordMeta || state.recordMeta.page >= state.recordMeta.totalPages;
}

function handleRecordTableAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) {
    return;
  }

  const recordId = Number(button.dataset.id);
  const action = button.dataset.action;

  if (action === 'edit') {
    const record = state.records.find((entry) => entry.id === recordId);
    if (!record) {
      return;
    }
    state.editingRecordId = recordId;
    elements.recordFormTitle.textContent = `Edit Record #${recordId}`;
    elements.recordSubmitButton.textContent = 'Update Record';
    elements.recordAmountInput.value = record.amount;
    elements.recordTypeInput.value = record.type;
    elements.recordCategoryInput.value = record.category;
    elements.recordDateInput.value = record.entryDate;
    elements.recordNotesInput.value = record.notes || '';
    return;
  }

  if (action === 'delete') {
    handleDeleteRecord(recordId);
    return;
  }

  if (action === 'restore') {
    handleRestoreRecord(recordId);
  }
}

async function handleDeleteRecord(recordId) {
  if (!window.confirm(`Soft delete record #${recordId}?`)) {
    return;
  }

  try {
    await apiFetch(`/records/${recordId}`, { method: 'DELETE' });
    notify(`Record #${recordId} moved to deleted state.`);
    await Promise.all([loadRecords(), loadDashboard()]);
  } catch (error) {
    notify(getErrorMessage(error), true);
  }
}

async function handleRestoreRecord(recordId) {
  try {
    await apiFetch(`/records/${recordId}/restore`, { method: 'POST', body: {} });
    notify(`Record #${recordId} restored.`);
    await Promise.all([loadRecords(), loadDashboard()]);
  } catch (error) {
    notify(getErrorMessage(error), true);
  }
}

async function handleRecordSubmit(event) {
  event.preventDefault();

  try {
    const payload = {
      amount: Number(elements.recordAmountInput.value),
      type: elements.recordTypeInput.value,
      category: elements.recordCategoryInput.value,
      entryDate: elements.recordDateInput.value,
      notes: elements.recordNotesInput.value,
    };

    if (state.editingRecordId) {
      await apiFetch(`/records/${state.editingRecordId}`, {
        method: 'PATCH',
        body: payload,
      });
      notify(`Record #${state.editingRecordId} updated.`);
    } else {
      await apiFetch('/records', {
        method: 'POST',
        body: payload,
      });
      notify('Record created.');
    }

    resetRecordForm();
    await Promise.all([loadRecords(), loadDashboard()]);
  } catch (error) {
    notify(getErrorMessage(error), true);
  }
}

function resetRecordForm() {
  state.editingRecordId = null;
  elements.recordForm.reset();
  elements.recordFormTitle.textContent = 'Create Record';
  elements.recordSubmitButton.textContent = 'Save Record';
}

async function loadUsers() {
  const response = await apiFetch('/users');
  state.users = response.data;
  renderUsers();
}

function renderUsers() {
  renderRows(
    elements.userTableBody,
    state.users,
    (user) => `
      <tr>
        <td>${escapeHtml(user.name)}</td>
        <td>${escapeHtml(user.email)}</td>
        <td>
          <select class="inline-select" data-role-select="${user.id}">
            ${['viewer', 'analyst', 'admin']
              .map(
                (role) =>
                  `<option value="${role}" ${
                    user.role === role ? 'selected' : ''
                  }>${role}</option>`
              )
              .join('')}
          </select>
        </td>
        <td>${escapeHtml(user.status)}</td>
        <td>
          <div class="row-actions">
            <button class="secondary-button" data-user-action="save" data-id="${user.id}" type="button">Save</button>
            <button class="${
              user.status === 'active' ? 'danger-button' : 'secondary-button'
            }" data-user-action="toggle-status" data-id="${user.id}" type="button">
              ${user.status === 'active' ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </td>
      </tr>
    `,
    5,
    'No users found.'
  );
}

async function handleUserCreate(event) {
  event.preventDefault();

  try {
    await apiFetch('/users', {
      method: 'POST',
      body: {
        name: elements.userNameInput.value,
        email: elements.userEmailInput.value,
        password: elements.userPasswordInput.value,
        role: elements.userRoleInput.value,
        status: elements.userStatusInput.value,
      },
    });

    elements.userForm.reset();
    elements.userRoleInput.value = 'viewer';
    elements.userStatusInput.value = 'active';
    notify('User created.');
    await loadUsers();
  } catch (error) {
    notify(getErrorMessage(error), true);
  }
}

function handleUserTableAction(event) {
  const button = event.target.closest('[data-user-action]');
  if (!button) {
    return;
  }

  const userId = Number(button.dataset.id);
  const action = button.dataset.userAction;

  if (action === 'save') {
    const select = elements.userTableBody.querySelector(
      `[data-role-select="${userId}"]`
    );
    if (!select) {
      return;
    }
    updateUser(userId, { role: select.value });
    return;
  }

  if (action === 'toggle-status') {
    const user = state.users.find((entry) => entry.id === userId);
    if (!user) {
      return;
    }
    const nextStatus = user.status === 'active' ? 'inactive' : 'active';
    updateUser(userId, { status: nextStatus });
  }
}

async function updateUser(userId, payload) {
  try {
    await apiFetch(`/users/${userId}`, {
      method: 'PATCH',
      body: payload,
    });
    notify(`User #${userId} updated.`);
    await loadUsers();
  } catch (error) {
    notify(getErrorMessage(error), true);
  }
}

function handleDashboardFilters(event) {
  event.preventDefault();
  loadDashboard().catch((error) => notify(getErrorMessage(error), true));
}

function handleRecordFilters(event) {
  event.preventDefault();
  state.recordFilters.page = 1;
  loadRecords().catch((error) => notify(getErrorMessage(error), true));
}

function changeRecordPage(step) {
  if (!state.recordMeta) {
    return;
  }

  const nextPage = state.recordFilters.page + step;
  if (nextPage < 1 || nextPage > state.recordMeta.totalPages) {
    return;
  }

  state.recordFilters.page = nextPage;
  loadRecords().catch((error) => notify(getErrorMessage(error), true));
}

function syncDashboardFiltersFromInputs() {
  state.dashboardFilters.from = elements.dashboardFrom.value;
  state.dashboardFilters.to = elements.dashboardTo.value;
  state.dashboardFilters.groupBy = elements.dashboardGroupBy.value;
  state.dashboardFilters.limit = elements.dashboardLimit.value || '5';
}

function syncRecordFiltersFromInputs() {
  state.recordFilters.type = elements.recordTypeFilter.value;
  state.recordFilters.category = elements.recordCategoryFilter.value.trim();
  state.recordFilters.search = elements.recordSearchFilter.value.trim();
  state.recordFilters.from = elements.recordFromFilter.value;
  state.recordFilters.to = elements.recordToFilter.value;
  state.recordFilters.pageSize = Number(elements.recordPageSizeFilter.value || 10);
  state.recordFilters.includeDeleted = Boolean(elements.includeDeletedFilter.checked);
}

async function apiFetch(path, options = {}) {
  const headers = {};
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw {
      status: response.status,
      payload,
    };
  }

  return payload;
}

function renderRows(target, items, renderer, columnCount, emptyMessage) {
  if (!items || items.length === 0) {
    target.innerHTML = `<tr><td colspan="${columnCount}">${escapeHtml(
      emptyMessage
    )}</td></tr>`;
    return;
  }

  target.innerHTML = items.map(renderer).join('');
}

function appendIfPresent(params, key, value) {
  if (value === '' || value === undefined || value === null) {
    return;
  }

  params.set(key, String(value));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getErrorMessage(error) {
  if (error?.payload?.error?.message) {
    return error.payload.error.message;
  }

  return 'Something went wrong.';
}

let toastTimer = null;
function notify(message, isError = false) {
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  elements.toast.style.background = isError
    ? 'rgba(122, 33, 33, 0.95)'
    : 'rgba(47, 36, 25, 0.94)';

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 2600);
}
