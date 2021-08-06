/*
 * Use Case
 * Run Greenwood with a custom context plugin that provides custom templates (app / page) and resources (JS / CSS); aka a "theme pack".
 *
 * User Result
 * Should generate a bare bones Greenwood build with expected templates being used from node_modules along with JS and CSS.
 *
 * User Command
 * greenwood build
 *
 * User Config
 * Mock Theme Pack Plugin (from fixtures)
 *
 * Custom Workspace
 * src/
 *   pages/
 *     slides/
 *       index.md
 *     index.md
 */
const expect = require('chai').expect;
const glob = require('glob-promise');
const { JSDOM } = require('jsdom');
const path = require('path');
const { getSetupFiles, getDependencyFiles, getOutputTeardownFiles } = require('../../../../../test/utils');
const Runner = require('gallinago').Runner;

describe('Build Greenwood With: ', function() {
  const LABEL = 'Custom Context Plugin and Default Workspace (aka Theme Packs)';
  const cliPath = path.join(process.cwd(), 'packages/cli/src/index.js');
  const outputPath = __dirname;
  let runner;

  before(function() {
    this.context = {
      publicDir: path.join(outputPath, 'public')
    };
    runner = new Runner();
  });

  describe(LABEL, function() {

    before(async function() {
      // copy fixtures into node_modules
      // to match the location specified in the plugin under test
      const themePacktemplates = await getDependencyFiles(
        `${__dirname}/fixtures/layouts/*.html`,
        `${outputPath}/node_modules/my-theme-pack/dist/layouts`
      );
      const themePackStyles = await getDependencyFiles(
        `${__dirname}/fixtures/styles/*.css`,
        `${outputPath}/node_modules/my-theme-pack/dist/styles`
      );
      const themePackComponents = await getDependencyFiles(
        `${__dirname}/fixtures/components/*.js`,
        `${outputPath}/node_modules/my-theme-pack/dist/components`
      );

      await runner.setup(outputPath, [
        ...getSetupFiles(outputPath),
        ...themePacktemplates,
        ...themePackStyles,
        ...themePackComponents
      ]);
      await runner.runCommand(cliPath, 'build');
    });

    runSmokeTest(['public', 'index'], LABEL);

    describe('Custom Default App and Page Templates', function() {
      let dom;

      before(async function() {
        dom = await JSDOM.fromFile(path.resolve(this.context.publicDir, 'index.html'));
      });

      it('should have expected text from from a mock package layout/app.html in node_modules/', function() {
        const pageTemplateHeading = dom.window.document.querySelectorAll('body h1')[0];

        expect(pageTemplateHeading.textContent).to.be.equal('This is a custom app template from the custom layouts directory.');
      });

      it('should have expected text from from a mock package layout/page.html in node_modules/', function() {
        const pageTemplateHeading = dom.window.document.querySelectorAll('body h2')[0];

        expect(pageTemplateHeading.textContent).to.be.equal('This is a custom (default) page template from the custom layouts directory.');
      });

      it('should have expected text from user workspace pages/index.md', function() {
        const pageHeadingPrimary = dom.window.document.querySelectorAll('body h3')[0];
        const pageHeadingSecondary = dom.window.document.querySelectorAll('body h4')[0];

        expect(pageHeadingPrimary.textContent).to.be.equal('Context Plugin Theme Pack Test');
        expect(pageHeadingSecondary.textContent).to.be.equal('From user workspace pages/index.md');
      });
    });

    describe('Custom Title Page Template', function() {
      let dom;

      before(async function() {
        dom = await JSDOM.fromFile(path.resolve(this.context.publicDir, 'slides/index.html'));
      });

      it('should have expected text from from a mock package layout/app.html in node_modules/', function() {
        const pageTemplateHeading = dom.window.document.querySelectorAll('body h1')[0];

        expect(pageTemplateHeading.textContent).to.be.equal('This is a custom app template from the custom layouts directory.');
      });

      it('should have expected text from from a mock package layout/title.html in node_modules/', function() {
        const pageTemplateHeading = dom.window.document.querySelectorAll('body h2')[0];

        expect(pageTemplateHeading.textContent).to.be.equal('This is a custom page template called title from the layouts directory.');
      });

      it('should have expected text from user workspace pages/index.md', function() {
        const pageHeadingPrimary = dom.window.document.querySelectorAll('body h3')[0];
        const pageHeadingSecondary = dom.window.document.querySelectorAll('body h4')[0];

        expect(pageHeadingPrimary.textContent).to.be.equal('Title Page');
        expect(pageHeadingSecondary.textContent).to.be.equal('Some content from title.md.');
      });
    });

    describe('Custom Theme Pack theme.css in app template', function() {
      let dom;

      before(async function() {
        dom = await JSDOM.fromFile(path.resolve(this.context.publicDir, 'index.html'));
      });

      it('should output a single CSS file for custom theme pack styles/theme.css', async function() {
        expect(await glob.promise(path.join(this.context.publicDir, '**/theme.*.css'))).to.have.lengthOf(1);
      });

      it('should have expected link tag in the head', function() {
        const linkTag = Array.from(dom.window.document.querySelectorAll('head link'))
          .filter((linkTag) => {
            return linkTag.getAttribute('rel') === 'stylesheet'
              && linkTag.getAttribute('href').indexOf('/theme.') === 0;
          });

        expect(linkTag.length).to.equal(1);
      });
    });

    describe('Custom Theme Pack greeting.js in custom title page template', function() {
      let dom;

      before(async function() {
        dom = await JSDOM.fromFile(path.resolve(this.context.publicDir, 'slides/index.html'));
      });

      it('should output a single JS file for custom theme pack components/greeting.js', async function() {
        expect(await glob.promise(path.join(this.context.publicDir, '**/greeting.*.js'))).to.have.lengthOf(1);
      });

      it('should have expected link tag in the head', function() {
        const scriptTag = Array.from(dom.window.document.querySelectorAll('head script'))
          .filter((linkTag) => {
            return linkTag.getAttribute('src').indexOf('/greeting.') === 0;
          });

        expect(scriptTag.length).to.equal(1);
      });

      it('should have expected greeting component content', function() {
        const greetingComponent = dom.window.document.querySelector('body x-greeting p');

        expect(greetingComponent.textContent).to.equal('Hello from the greeting component!');
      });
    });
  });

  after(function() {
    runner.teardown(getOutputTeardownFiles(outputPath));
  });

});