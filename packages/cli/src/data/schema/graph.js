const gql = require('graphql-tag');

const getMenuFromGraph = async (root, { name, pathname, orderBy }, context) => {
  const { graph } = context;
  let items = [];

  graph
    .forEach((page) => {
      const { route, data, title } = page;
      const { menu, index, tableOfContents, linkheadings } = data;
      let children = getParsedHeadingsFromPage(tableOfContents, linkheadings);

      if (menu && menu.search(name) > -1) {
        if (pathname) {
          // check we're querying only pages that contain base route
          let baseRoute = pathname;
          let baseRouteIndex = pathname.substring(1, pathname.length).indexOf('/');
          if (baseRouteIndex > -1) {
            baseRoute = pathname.substring(0, baseRouteIndex + 1);
          }

          if (route.includes(baseRoute)) {
            items.push({ item: { link: route, label: title, index }, children });
          }
        } else {
          items.push({ item: { link: route, label: title, index }, children });
        }
      }
    });
  if (orderBy !== '') {
    items = sortMenuItems(items, orderBy);
  }
  return { item: { label: name, link: 'na' }, children: items };
};

const sortMenuItems = (menuItems, order) => {
  const compare = (a, b) => {
    if (order === 'title_asc' || order === 'title_desc') {
      a = a.item.label, b = b.item.label;
    }
    if (order === 'index_asc' || order === 'index_desc') {
      a = a.item.index, b = b.item.index;
    }
    if (order === 'title_asc' || order === 'index_asc') {
      if (a < b) {
        return -1;
      }
      if (a > b) {
        return 1;
      }
    } else if (order === 'title_desc' || order === 'index_desc') {
      if (a > b) {
        return -1;
      }
      if (a < b) {
        return 1;
      }
    }
    return 0;
  };

  menuItems.sort(compare);
  return menuItems;
};

const getParsedHeadingsFromPage = (tableOfContents, headingLevel) => {
  let children = [];

  if (tableOfContents.length > 0 && headingLevel > 0) {
    tableOfContents.forEach(({ content, slug, lvl }) => {
      // make sure we only add heading elements of the same level (h1, h2, h3)
      if (lvl === headingLevel) {
        children.push({ item: { label: content, link: '#' + slug }, children: [] });
      }
    });
  }
  return children;
};

const getDeriveMetaFromRoute = (route) => {
  const root = route.split('/')[1] || '';
  const label = root
    .replace('/', '')
    .replace('-', ' ')
    .split(' ')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.substring(1)}`)
    .join(' ');

  return {
    label,
    root
  };
};

const getPagesFromGraph = async (root, query, context) => {
  const pages = [];
  const { graph } = context;

  graph
    .forEach((page) => {
      const { route, mdFile, fileName, template, title, data } = page;
      const { label } = getDeriveMetaFromRoute(route);
      const id = page.label;

      pages.push({
        id,
        filePath: mdFile,
        fileName,
        template,
        title: title !== '' ? title : label,
        link: route,
        data: {
          ...data
        }
      });
    });

  return pages;
};

const getChildrenFromParentRoute = async (root, query, context) => {
  const pages = [];
  const { parent } = query;
  const { graph } = context;

  graph
    .forEach((page) => {
      const { route, mdFile, fileName, template, title, data } = page;
      const { label } = getDeriveMetaFromRoute(route);
      const root = route.split('/')[1];

      if (root.indexOf(parent) >= 0) {
        const id = page.label;

        pages.push({
          id,
          filePath: mdFile,
          fileName,
          template,
          title: title !== '' ? title : label,
          link: route,
          data: {
            ...data
          }
        });
      }
    });

  return pages;
};

const graphTypeDefs = gql`
  type Page {
    data: Data,
    id: String,
    filePath: String,
    fileName: String,
    template: String,
    link: String,
    title: String
  }

  type Link {
    label: String,
    link: String
  }

  type Menu {
    item: Link
    children: [Menu]
  }

  enum MenuOrderBy {
    title_asc,
    title_desc
    index_asc,
    index_desc
  }

  type Query {
    graph: [Page]
    menu(name: String, orderBy: MenuOrderBy, pathname: String): Menu
    children(parent: String): [Page]
  }
`;

const graphResolvers = {
  Query: {
    graph: getPagesFromGraph,
    menu: getMenuFromGraph,
    children: getChildrenFromParentRoute
  }
};

module.exports = {
  graphTypeDefs,
  graphResolvers
};