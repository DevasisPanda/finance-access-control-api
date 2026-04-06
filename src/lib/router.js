function escapeRegex(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compilePath(pathname) {
  if (pathname === '/') {
    return {
      regex: /^\/$/,
      paramNames: [],
    };
  }

  const parts = pathname.split('/').filter(Boolean);
  const paramNames = [];
  const pattern = parts
    .map((part) => {
      if (part.startsWith(':')) {
        paramNames.push(part.slice(1));
        return '([^/]+)';
      }

      return escapeRegex(part);
    })
    .join('/');

  return {
    regex: new RegExp(`^/${pattern}$`),
    paramNames,
  };
}

function createRouter() {
  const routes = [];

  function add(method, path, options, handler) {
    const normalizedOptions = handler ? options : {};
    const normalizedHandler = handler || options;
    const compiled = compilePath(path);

    routes.push({
      method: method.toUpperCase(),
      path,
      options: normalizedOptions,
      handler: normalizedHandler,
      regex: compiled.regex,
      paramNames: compiled.paramNames,
    });
  }

  function match(method, pathname) {
    const upperMethod = method.toUpperCase();

    for (const route of routes) {
      if (route.method !== upperMethod) {
        continue;
      }

      const matched = pathname.match(route.regex);
      if (!matched) {
        continue;
      }

      const params = {};
      route.paramNames.forEach((name, index) => {
        params[name] = decodeURIComponent(matched[index + 1]);
      });

      return {
        ...route,
        params,
      };
    }

    return null;
  }

  return {
    add,
    match,
  };
}

module.exports = {
  createRouter,
};
