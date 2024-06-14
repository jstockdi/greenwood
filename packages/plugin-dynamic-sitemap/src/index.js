import fs from 'fs/promises';

const greenwoodPluginDynamicExport = (options = {}) => [{
  type: 'copy',
  name: 'plugin-dynamic-sitemap',
  provider: async (compilation) => {

    const { baseUrl } = options;
    const { outputDir } = compilation.context;

    let sitemapXML = '<?xml version="1.0" encoding="UTF-8"?>\n';
    sitemapXML += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    compilation.graph.forEach(page => {
      sitemapXML += `<url><loc>${baseUrl}${page.outputPath}</loc></url>\n`;
    });

    sitemapXML += '</urlset>';

    const sitemapUrl = new URL('./sitemap.xml', outputDir);
    await fs.writeFile(sitemapUrl, sitemapXML);

    return {
      from: sitemapUrl,
      to: new URL('./sitemap.xml', outputDir)
    };
  }
}];

export { greenwoodPluginDynamicExport };