/* eslint-disable complexity */
/*
 * 
 * Manages web standard resource related operations for HTML and markdown.
 * This is a Greenwood default plugin.
 *
 */
import frontmatter from 'front-matter';
import fs from 'fs';
import htmlparser from 'node-html-parser';
import path from 'path';
import rehypeStringify from 'rehype-stringify';
import rehypeRaw from 'rehype-raw';
import remarkFrontmatter from 'remark-frontmatter';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { ResourceInterface } from '../../lib/resource-interface.js';
import unified from 'unified';
import { fileURLToPath, URL } from 'url';

function getCustomPageTemplates(contextPlugins, templateName) {
  return contextPlugins
    .map(plugin => plugin.templates)
    .flat()
    .filter((templateDir) => {
      return templateName && fs.existsSync(path.join(templateDir, `${templateName}.html`));
    });
}

const getPageTemplate = (barePath, templatesDir, template, contextPlugins = [], pagesDir) => {
  const pageIsHtmlPath = `${barePath.substring(0, barePath.lastIndexOf(`${path.sep}index`))}.html`;
  const customPluginDefaultPageTemplates = getCustomPageTemplates(contextPlugins, 'page');
  const customPluginPageTemplates = getCustomPageTemplates(contextPlugins, template);
  const is404Page = barePath.replace(pagesDir, '').indexOf(`${path.sep}404`) === 0;
  let contents;

  if (template && customPluginPageTemplates.length > 0 || fs.existsSync(`${templatesDir}/${template}.html`)) {
    // use a custom template, usually from markdown frontmatter
    contents = customPluginPageTemplates.length > 0
      ? fs.readFileSync(`${customPluginPageTemplates[0]}/${template}.html`, 'utf-8')
      : fs.readFileSync(`${templatesDir}/${template}.html`, 'utf-8');
  } else if (fs.existsSync(`${barePath}.html`) || fs.existsSync(pageIsHtmlPath)) {
    // if the page is already HTML, use that as the template
    const indexPath = fs.existsSync(pageIsHtmlPath)
      ? pageIsHtmlPath
      : `${barePath}.html`;
    
    contents = fs.readFileSync(indexPath, 'utf-8');
  } else if (customPluginDefaultPageTemplates.length > 0 || (!is404Page && fs.existsSync(`${templatesDir}/page.html`))) {
    // else look for default page template from the user
    // and 404 pages should be their own "top level" template
    contents = customPluginDefaultPageTemplates.length > 0
      ? fs.readFileSync(`${customPluginDefaultPageTemplates[0]}/page.html`, 'utf-8')
      : fs.readFileSync(`${templatesDir}/page.html`, 'utf-8');
  } else if (is404Page && !fs.existsSync(path.join(pagesDir, '404.html'))) {
    contents = fs.readFileSync(fileURLToPath(new URL('../../templates/404.html', import.meta.url)), 'utf-8');
  } else {
    // fallback to using Greenwood's stock page template
    contents = fs.readFileSync(fileURLToPath(new URL('../../templates/page.html', import.meta.url)), 'utf-8');
  }

  return contents;
};

const getAppTemplate = (contents, templatesDir, customImports = [], contextPlugins, enableHud) => {
  const userAppTemplatePath = `${templatesDir}app.html`;
  const customAppTemplates = getCustomPageTemplates(contextPlugins, 'app');

  let appTemplateContents = customAppTemplates.length > 0
    ? fs.readFileSync(`${customAppTemplates[0]}/app.html`, 'utf-8')
    : fs.existsSync(userAppTemplatePath)
      ? fs.readFileSync(userAppTemplatePath, 'utf-8')
      : fs.readFileSync(fileURLToPath(new URL('../../templates/app.html', import.meta.url)), 'utf-8');

  const root = htmlparser.parse(contents, {
    script: true,
    style: true,
    noscript: true,
    pre: true
  });
  const appRoot = htmlparser.parse(appTemplateContents, {
    script: true,
    style: true
  });

  if (!root.valid) {
    console.debug('ERROR: Invalid HTML detected');

    if (enableHud) {
      appTemplateContents = appTemplateContents.replace('<body>', `
        <body>
          <div style="position: absolute; width: auto; border: dotted 3px red; background-color: white; opacity: 0.75; padding: 1% 1% 0">
            <p>Malformed HTML detected, please check your closing tags or an <a href="https://www.google.com/search?q=html+formatter" target="_blank" rel="nopener noreferrer">HTML formatter</a>.</p>
            <details>
              <pre>
                ${contents.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}
              </pre>
            </details>
          </div>
      `);
    }

    appTemplateContents = appTemplateContents.replace(/<page-outlet><\/page-outlet>/, '');
  } else {
    const body = root.querySelector('body') ? root.querySelector('body').innerHTML : '';
    const headScripts = root.querySelectorAll('head script');
    const headLinks = root.querySelectorAll('head link');
    const headMeta = root.querySelectorAll('head meta');
    const headStyles = root.querySelectorAll('head style');
    const headTitle = root.querySelector('head title');
    const appTemplateHeadContents = appRoot.querySelector('head').innerHTML;

    appTemplateContents = appTemplateContents.replace(/<page-outlet><\/page-outlet>/, body);

    if (headTitle) {
      appTemplateContents = appTemplateContents.replace(/<title>(.*)<\/title>/, `<title>${headTitle.rawText}</title>`);
    }

    // merge <script> tags
    if (headScripts.length > 0) {
      const matchNeedleScript = /<script .*/g;
      const appHeadScriptMatches = appTemplateHeadContents.match(matchNeedleScript);
      const lastScript = appHeadScriptMatches && appHeadScriptMatches.length && appHeadScriptMatches.length > 0
        ? appHeadScriptMatches[appHeadScriptMatches.length - 1]
        : '</head>';
      const pageBodyScripts = headScripts.map((script) => {
        if (script.text === '') {
          return `<script ${script.rawAttrs}></script>`;
        } else {
          const attributes = script.rawAttrs !== ''
            ? ` ${script.rawAttrs}`
            : '';
          const source = script.text.replace(/\$/g, '$$$'); // https://github.com/ProjectEvergreen/greenwood/issues/656

          return `
            <script${attributes}>
              ${source}
            </script>
          `;
        }
      });

      if (lastScript === '</head>') {
        appTemplateContents = appTemplateContents.replace(lastScript, `
          ${pageBodyScripts.join('\n')}
        ${lastScript}\n
      `);
      } else {
        appTemplateContents = appTemplateContents.replace(lastScript, `${lastScript}\n
          ${pageBodyScripts.join('\n')}
        `);
      }
    }

    // merge <link> tags
    if (headLinks.length > 0) {
      const matchNeedleLink = /<link .*/g;
      const appHeadLinkMatches = appTemplateHeadContents.match(matchNeedleLink);
      const lastLink = appHeadLinkMatches && appHeadLinkMatches.length && appHeadLinkMatches.length > 0
        ? appHeadLinkMatches[appHeadLinkMatches.length - 1]
        : '</head>';
      const pageHeadLinks = headLinks.map((link) => {
        return `<link ${link.rawAttrs}/>`;
      });

      if (lastLink === '</head>') {
        appTemplateContents = appTemplateContents.replace(lastLink, `
          ${pageHeadLinks.join('\n')}
        ${lastLink}\n
      `);
      } else {
        appTemplateContents = appTemplateContents.replace(lastLink, `${lastLink}\n
          ${pageHeadLinks.join('\n')}
        `);
      }
    }

    // merge <style> tags
    if (headStyles.length > 0) {
      const latestHeadContents = appTemplateContents.match(/<head>.*.<\/head>/s)[0];
      const pageBodyStyles = headStyles.map((style) => {
        const attributes = style.rawAttrs === '' ? '' : ` ${style.rawAttrs}`;

        return `
          <style${attributes}>
            ${style.text}
          </style>
        `;
      });
      const lastIndex = latestHeadContents.lastIndexOf('</style>') === -1
        ? latestHeadContents.lastIndexOf('</head>')
        : latestHeadContents.lastIndexOf('</style>');
      const offset = lastIndex === -1 ? '</head>'.length : '</style>'.length;
      const result = latestHeadContents.substring(0, lastIndex + offset) + pageBodyStyles.join('\n') + latestHeadContents.substring(lastIndex);

      appTemplateContents = appTemplateContents.replace(latestHeadContents, result);
    }

    // merge <meta>
    if (headMeta.length > 0) {
      const matchNeedleMeta = /<meta .*/g;
      const appHeadMetaMatches = appTemplateHeadContents.match(matchNeedleMeta);
      const lastMeta = appHeadMetaMatches && appHeadMetaMatches.length && appHeadMetaMatches.length > 0
        ? appHeadMetaMatches[appHeadMetaMatches.length - 1]
        : '<head>';
      const pageMeta = headMeta.map((meta) => {
        return `<meta ${meta.rawAttrs}/>`;
      });

      appTemplateContents = appTemplateContents.replace(lastMeta.replace('>', '/>'), `${lastMeta.replace('>', '/>')}\n
        ${pageMeta.join('\n')}
      `);
    }

    customImports.forEach((customImport) => {
      const extension = path.extname(customImport);

      switch (extension) {

        case '.js':
          appTemplateContents = appTemplateContents.replace('</head>', `
              <script src="${customImport}" type="module"></script>
            </head>
          `);
          break;
        case '.css':
          appTemplateContents = appTemplateContents.replace('</head>', `
            <link rel="stylesheet" href="${customImport}"></link>
            </head>
          `);
          break;

        default:
          break;

      }
    });
  }

  return appTemplateContents;
};

const getUserScripts = (contents, context) => {
  // polyfill chromium for WC support
  // https://lit.dev/docs/tools/requirements/#polyfills
  if (process.env.__GWD_COMMAND__ === 'build') { // eslint-disable-line no-underscore-dangle
    const { projectDirectory, userWorkspace } = context;
    const dependencies = fs.existsSync(path.join(userWorkspace, 'package.json')) // handle monorepos first
      ? JSON.parse(fs.readFileSync(path.join(userWorkspace, 'package.json'), 'utf-8')).dependencies
      : fs.existsSync(path.join(projectDirectory, 'package.json'))
        ? JSON.parse(fs.readFileSync(path.join(projectDirectory, 'package.json'), 'utf-8')).dependencies
        : {};

    const litPolyfill = dependencies && dependencies.lit
      ? '<script src="/node_modules/lit/polyfill-support.js"></script>\n'
      : '';

    contents = contents.replace('<head>', `
      <head>
        ${litPolyfill}
        <script src="/node_modules/@webcomponents/webcomponentsjs/webcomponents-bundle.js"></script>
    `);
  }
  return contents;
};

const getMetaContent = (url, config, contents) => {
  const existingTitleMatch = contents.match(/<title>(.*)<\/title>/);
  const existingTitleCheck = !!(existingTitleMatch && existingTitleMatch[1] && existingTitleMatch[1] !== '');

  const title = existingTitleCheck
    ? existingTitleMatch[1]
    : config.title;
  const metaContent = config.meta.map(item => {
    let metaHtml = '';

    for (const [key, value] of Object.entries(item)) {
      const isOgUrl = item.property === 'og:url' && key === 'content';
      const hasTrailingSlash = isOgUrl && value[value.length - 1] === '/';
      const contextualValue = isOgUrl
        ? hasTrailingSlash
          ? `${value}${url.replace('/', '')}`
          : `${value}${url === '/' ? '' : url}`
        : value;
        
      metaHtml += ` ${key}="${contextualValue}"`;
    }

    return item.rel
      ? `<link${metaHtml}/>`
      : `<meta${metaHtml}/>`;
  }).join('\n');

  // add an empty <title> if it's not already there
  if (!existingTitleMatch) {
    contents = contents.replace('<head>', '<head><title></title>');
  }

  contents = contents.replace(/<title>(.*)<\/title>/, `<title>${title}</title>`);
  contents = contents.replace('<meta-outlet></meta-outlet>', metaContent);

  return contents;
};

class StandardHtmlResource extends ResourceInterface {
  constructor(compilation, options) {
    super(compilation, options);
    
    this.extensions = ['.html', '.md'];
    this.contentType = 'text/html';
  }

  getRelativeUserworkspaceUrl(url) {
    return path.normalize(url.replace(this.compilation.context.userWorkspace, ''));
  }

  async shouldServe(url, headers) {
    const { pagesDir } = this.compilation.context;
    const relativeUrl = this.getRelativeUserworkspaceUrl(url);
    const isClientSideRoute = this.compilation.config.mode === 'spa' && path.extname(url) === '' && (headers.request.accept || '').indexOf(this.contentType) >= 0;
    const barePath = relativeUrl.endsWith(path.sep)
      ? `${pagesDir}${relativeUrl}index`
      : `${pagesDir}${relativeUrl.replace('.html', '')}`;
    const isExternalSource = this.compilation.graph.filter((node) => {
      return node.external && node.route.indexOf(url) >= 0;
    }).length === 1;

    return Promise.resolve(this.extensions.indexOf(path.extname(relativeUrl)) >= 0
      || path.extname(relativeUrl) === '') && (fs.existsSync(`${barePath}.html`) || barePath.substring(barePath.length - 5, barePath.length) === 'index')
      || fs.existsSync(`${barePath}.md`)
      || fs.existsSync(`${barePath.substring(0, barePath.lastIndexOf(`${path.sep}index`))}.md`)
      || isClientSideRoute
      || isExternalSource;
  }

  async serve(url) {
    return new Promise(async (resolve, reject) => {
      try {
        const config = Object.assign({}, this.compilation.config);
        const { pagesDir, userTemplatesDir, userWorkspace } = this.compilation.context;
        const { mode } = this.compilation.config;
        const normalizedUrl = this.getRelativeUserworkspaceUrl(url);
        const userHasOwn404 = fs.existsSync(path.join(userWorkspace, 'pages/404.html')) || fs.existsSync(path.join(userWorkspace, 'pages/404.md'));
        let customImports;

        let body = '';
        let template = null;
        let processedMarkdown = null;
        const barePath = url === '/404/' && userHasOwn404
          ? path.join(userWorkspace, 'pages/404')
          : normalizedUrl.endsWith(path.sep)
            ? `${pagesDir}${normalizedUrl}index`
            : `${pagesDir}${normalizedUrl.replace('.html', '')}`;
        const isMarkdownContent = fs.existsSync(`${barePath}.md`)
          || fs.existsSync(`${barePath.substring(0, barePath.lastIndexOf(`${path.sep}index`))}.md`)
          || fs.existsSync(`${barePath.replace(`${path.sep}index`, '.md')}`);
        const externalSource = this.compilation.graph.filter((node) => {
          return node.external && node.route.indexOf(url) >= 0;
        });

        if (externalSource.length === 1) {
          template = externalSource[0].template || template;
        }

        if (isMarkdownContent) {
          const markdownPath = fs.existsSync(`${barePath}.md`)
            ? `${barePath}.md`
            : fs.existsSync(`${barePath.substring(0, barePath.lastIndexOf(`${path.sep}index`))}.md`)
              ? `${barePath.substring(0, barePath.lastIndexOf(`${path.sep}index`))}.md`
              : `${pagesDir}${url.replace(`${path.sep}index.html`, '.md')}`;
          const markdownContents = await fs.promises.readFile(markdownPath, 'utf-8');
          const rehypePlugins = [];
          const remarkPlugins = [];

          for (const plugin of config.markdown.plugins) {
            if (plugin.indexOf('rehype-') >= 0) {
              rehypePlugins.push((await import(plugin)).default);
            }

            if (plugin.indexOf('remark-') >= 0) {
              remarkPlugins.push((await import(plugin)).default);
            }
          }

          const settings = config.markdown.settings || {};
          const fm = frontmatter(markdownContents);
          processedMarkdown = await unified()
            .use(remarkParse, settings) // parse markdown into AST
            .use(remarkFrontmatter) // extract frontmatter from AST
            .use(remarkPlugins) // apply userland remark plugins
            .use(remarkRehype, { allowDangerousHtml: true }) // convert from markdown to HTML AST
            .use(rehypeRaw) // support mixed HTML in markdown
            .use(rehypePlugins) // apply userland rehype plugins
            .use(rehypeStringify) // convert AST to HTML string
            .process(markdownContents);

          // configure via frontmatter
          if (fm.attributes) {
            const { attributes } = fm;

            if (attributes.title) {
              config.title = `${config.title} - ${attributes.title}`;
            }
  
            if (attributes.template) {
              template = attributes.template;
            }

            if (attributes.imports) {
              customImports = attributes.imports;
            }
          }
        }

        // get context plugins
        const contextPlugins = this.compilation.config.plugins.filter((plugin) => {
          return plugin.type === 'context';
        }).map((plugin) => {
          return plugin.provider(this.compilation);
        });

        if (mode === 'spa') {
          body = fs.readFileSync(this.compilation.graph[0].path, 'utf-8');
        } else {
          body = getPageTemplate(barePath, userTemplatesDir, template, contextPlugins, pagesDir);
        }

        body = getAppTemplate(body, userTemplatesDir, customImports, contextPlugins, config.devServer.hud);
        body = getUserScripts(body, this.compilation.context);
        body = getMetaContent(normalizedUrl.replace(/\\/g, '/'), config, body);
        
        if (processedMarkdown) {
          const wrappedCustomElementRegex = /<p><[a-zA-Z]*-[a-zA-Z](.*)>(.*)<\/[a-zA-Z]*-[a-zA-Z](.*)><\/p>/g;
          const ceTest = wrappedCustomElementRegex.test(processedMarkdown.contents);

          if (ceTest) {
            const ceMatches = processedMarkdown.contents.match(wrappedCustomElementRegex);

            ceMatches.forEach((match) => {
              const stripWrappingTags = match
                .replace('<p>', '')
                .replace('</p>', '');

              processedMarkdown.contents = processedMarkdown.contents.replace(match, stripWrappingTags);
            });
          }

          body = body.replace(/\<content-outlet>(.*)<\/content-outlet>/s, processedMarkdown.contents);
        } else if (externalSource.length === 1) {
          body = body.replace(/\<content-outlet>(.*)<\/content-outlet>/s, externalSource[0].body);
        }

        // give the user something to see so they know it works, if they have no content
        if (body.indexOf('<content-outlet></content-outlet>') > 0) {
          body = body.replace('<content-outlet></content-outlet>', `
            <h1>Welcome to Greenwood!</h1>
          `);
        }

        resolve({
          body,
          contentType: this.contentType
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  async shouldOptimize(url) {
    return Promise.resolve(path.extname(url) === '.html');
  }

  async optimize(url, body) {
    return new Promise((resolve, reject) => {
      try {
        const hasHead = body.match(/\<head>(.*)<\/head>/s);

        if (hasHead && hasHead.length > 0) {
          let contents = hasHead[0];

          contents = contents.replace(/<script src="(.*lit\/polyfill-support.js)"><\/script>/, '');
          contents = contents.replace(/<script src="(.*webcomponents-bundle.js)"><\/script>/, '');
          contents = contents.replace(/<script type="importmap-shim">.*?<\/script>/s, '');
          contents = contents.replace(/<script defer="" src="(.*es-module-shims.js)"><\/script>/, '');
          contents = contents.replace(/type="module-shim"/g, 'type="module"');

          body = body.replace(/\<head>(.*)<\/head>/s, contents.replace(/\$/g, '$$$')); // https://github.com/ProjectEvergreen/greenwood/issues/656);
        }
    
        resolve(body);
      } catch (e) {
        reject(e);
      }
    });
  }
}

const greenwoodPluginStandardHtml = {
  type: 'resource',
  name: 'plugin-standard-html',
  provider: (compilation, options) => new StandardHtmlResource(compilation, options)
};

export { greenwoodPluginStandardHtml };