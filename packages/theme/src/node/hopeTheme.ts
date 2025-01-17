import { isPlainObject } from "@vuepress/helper";
import { watch } from "chokidar";
import type { ThemeFunction } from "vuepress/core";
import { TEMPLATE_RENDERER_OUTLETS } from "vuepress/utils";

import {
  checkMarkdownOptions,
  checkUserPlugins,
  checkVuePressVersion,
} from "./check/index.js";
import { checkLegacyStyle, convertThemeOptions } from "./compact/index.js";
import {
  getSocialMediaIcons,
  getThemeData,
  getThemeStatus,
} from "./config/index.js";
import { extendsBundlerOptions } from "./extendsBundlerOptions.js";
import { getAlias } from "./getAlias.js";
import { addFavicon } from "./init/index.js";
import { getPlugins, usePlugins } from "./plugins/index.js";
import {
  prepareBundleConfigFile,
  prepareHighLighterScss,
  prepareSeparatedConfigFile,
  prepareSidebarData,
  prepareSocialMediaIcons,
} from "./prepare/index.js";
import type { HopeThemeBehaviorOptions } from "./typings/index.js";
import { TEMPLATE_FOLDER, VERSION } from "./utils.js";
import type { ThemeOptions } from "../shared/index.js";

export const hopeTheme = (
  options: ThemeOptions,
  // TODO: Change default value in v2 stable
  behavior: HopeThemeBehaviorOptions | boolean = true,
): ThemeFunction => {
  checkVuePressVersion();

  return (app) => {
    const behaviorOptions = isPlainObject(behavior)
      ? behavior
      : behavior
        ? { compact: true, check: true }
        : {};
    const isDebug = behaviorOptions.debug
      ? (app.env.isDebug = true)
      : app.env.isDebug;

    const {
      favicon,
      hotReload = isDebug,
      plugins = {},
      hostname,
      iconAssets,
      iconPrefix,
      sidebarSorter,
      ...themeOptions
    } = behaviorOptions.compact
      ? convertThemeOptions(options as ThemeOptions & Record<string, unknown>)
      : options;

    if (behaviorOptions.compact) checkLegacyStyle(app);

    const status = getThemeStatus(app, options);
    const themeData = getThemeData(app, themeOptions, status);
    const icons = status.enableBlog ? getSocialMediaIcons(themeData) : {};

    usePlugins(app, themeData, plugins, hotReload, behaviorOptions);

    if (isDebug) console.log("Theme plugin options:", plugins);

    return {
      name: "vuepress-theme-hope",

      alias: behaviorOptions.custom ? getAlias(isDebug) : {},

      define: () => ({
        BLOG_TYPE_INFO: status.blogType,
        ENABLE_BLOG: status.enableBlog,
        ENABLE_READING_TIME: status.enableReadingTime,
        HAS_MULTIPLE_LANGUAGES: status.hasMultipleLanguages,
      }),

      extendsBundlerOptions,

      extendsMarkdownOptions: (markdownOptions): void => {
        if (behaviorOptions.check)
          checkMarkdownOptions(markdownOptions, themeData);
      },

      onInitialized: (app): void => {
        if (favicon) addFavicon(app, favicon);
        if (behaviorOptions.check) checkUserPlugins(app);
      },

      onPrepared: (app): Promise<void> =>
        Promise.all([
          prepareSidebarData(app, themeData, sidebarSorter),
          prepareHighLighterScss(app, plugins),
          prepareSocialMediaIcons(app, icons),
        ]).then(() => void 0),

      onWatched: (app, watchers): void => {
        if (hotReload) {
          // This ensures the page is generated or updated
          const structureSidebarWatcher = watch("pages/**/*.vue", {
            cwd: app.dir.temp(),
            ignoreInitial: true,
          });

          structureSidebarWatcher.on("add", () => {
            void prepareSidebarData(app, themeData, sidebarSorter);
          });
          structureSidebarWatcher.on("change", () => {
            void prepareSidebarData(app, themeData, sidebarSorter);
          });
          structureSidebarWatcher.on("unlink", () => {
            void prepareSidebarData(app, themeData, sidebarSorter);
          });

          watchers.push(structureSidebarWatcher);
        }
      },

      plugins: getPlugins(
        app,
        plugins,
        themeData,

        // @ts-ignore
        {
          hostname,
          hotReload,
          iconAssets,
          iconPrefix,
          favicon,
        },
        behaviorOptions.compact,
      ),

      templateBuild: `${TEMPLATE_FOLDER}index.build.html`,

      templateBuildRenderer: (
        template: string,
        { content, head, lang, prefetch, preload, scripts, styles, version },
      ): string =>
        template
          .replace(TEMPLATE_RENDERER_OUTLETS.CONTENT, () => content)
          .replace(TEMPLATE_RENDERER_OUTLETS.HEAD, head)
          .replace("{{ themeVersion }}", VERSION)
          .replace(
            "{{ themeMode }}",
            themeOptions.darkmode === "enable" ? "dark" : "light",
          )
          .replace(TEMPLATE_RENDERER_OUTLETS.LANG, lang)
          .replace(TEMPLATE_RENDERER_OUTLETS.PREFETCH, prefetch)
          .replace(TEMPLATE_RENDERER_OUTLETS.PRELOAD, preload)
          .replace(TEMPLATE_RENDERER_OUTLETS.SCRIPTS, scripts)
          .replace(TEMPLATE_RENDERER_OUTLETS.STYLES, styles)
          .replace(TEMPLATE_RENDERER_OUTLETS.VERSION, version),

      clientConfigFile: (app) =>
        behaviorOptions.custom
          ? prepareSeparatedConfigFile(app, status)
          : prepareBundleConfigFile(app, status),
    };
  };
};
