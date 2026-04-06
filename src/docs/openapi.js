function getOpenApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Finance Records Service',
      version: '1.0.0',
      description:
        'Role-based finance records API with summary reporting and a supporting operations console.',
    },
    servers: [
      {
        url: '/',
      },
    ],
    paths: {
      '/auth/login': {
        post: {
          summary: 'Authenticate a user',
        },
      },
      '/auth/logout': {
        post: {
          summary: 'Invalidate the current session token',
        },
      },
      '/auth/me': {
        get: {
          summary: 'Get the authenticated user profile',
        },
      },
      '/users': {
        get: {
          summary: 'List users',
        },
        post: {
          summary: 'Create a user',
        },
      },
      '/users/{id}': {
        get: {
          summary: 'Get a user by id',
        },
        patch: {
          summary: 'Update a user',
        },
      },
      '/records': {
        get: {
          summary: 'List financial records with filters and pagination',
        },
        post: {
          summary: 'Create a financial record',
        },
      },
      '/records/{id}': {
        get: {
          summary: 'Get a financial record by id',
        },
        patch: {
          summary: 'Update a financial record',
        },
        delete: {
          summary: 'Soft delete a financial record',
        },
      },
      '/records/{id}/restore': {
        post: {
          summary: 'Restore a soft-deleted financial record',
        },
      },
      '/dashboard/overview': {
        get: {
          summary: 'Get dashboard totals, category breakdown, recent activity, and trends',
        },
      },
      '/dashboard/trends': {
        get: {
          summary: 'Get grouped income and expense trends',
        },
      },
      '/openapi.json': {
        get: {
          summary: 'Get the machine-readable API description',
        },
      },
    },
  };
}

module.exports = {
  getOpenApiSpec,
};
