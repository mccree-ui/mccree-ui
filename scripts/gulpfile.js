/* eslint-disable @typescript-eslint/no-invalid-this */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");
const gulp = require("gulp");
const less = require("gulp-less");
const autoprefixer = require("gulp-autoprefixer");
const cssnano = require("gulp-cssnano");
const merge2 = require("merge2");
const ts = require("gulp-typescript");
const tsConfig = require("../tsconfig.json");
const argv = require("minimist")(process.argv.slice(2));
const getBabelCommonConfig = require("./getBabelCommonConfig");
const babel = require("gulp-babel");
const through2 = require("through2");
const rimraf = require("rimraf");
const webpack = require("webpack");
const webpackConfig = require("./webpack.config");

const tsDefaultReporter = ts.reporter.defaultReporter();

const browserList = ["last 2 versions", "Android >= 4.0", "Firefox ESR", "not ie < 9"];

function cssInjection(content) {
    return content
        .replace(/\/style\/?'/g, "/style/css'")
        .replace(/\/style\/?"/g, '/style/css"')
        .replace(/\.less/g, ".css");
}

const libDir = path.resolve(__dirname, "../lib");
const esDir = path.resolve(__dirname, "../es");
const distDir = path.resolve(__dirname, "../dist");

function dist(done) {
    rimraf.sync(distDir);

    process.env.RUN_ENV = "PRODUCTION";

    webpack(webpackConfig, (err, stats) => {
        if (err) {
            console.error(err.stack || err);
            if (err.details) {
                console.error(err.details);
            }
            return;
        }

        const info = stats.toJson();

        if (stats.hasErrors()) {
            console.error(info.errors);
        }

        // if (stats.hasWarnings()) {
        //     console.warn(info.warnings);
        // }

        const buildInfo = stats.toString({
            colors: true,
            children: true,
            chunks: false,
            modules: false,
            chunkModules: false,
            hash: false,
            version: false,
            warningsFilter: [/export .* was not found in/]
        });
        console.log(buildInfo);
        done(0);
    });
}

function babelify(js, modules) {
    const babelConfig = getBabelCommonConfig(modules);
    delete babelConfig.cacheDirectory;

    let stream = js.pipe(babel(babelConfig)).pipe(
        through2.obj(function z(file, encoding, next) {
            this.push(file.clone());
            if (file.path.match(/(\/|\\)style(\/|\\)index\.js/)) {
                const content = file.contents.toString(encoding);

                file.contents = Buffer.from(cssInjection(content));
                file.path = file.path.replace(/index\.js/, "css.js");
                this.push(file);
                next();
            } else {
                next();
            }
        })
    );

    return stream.pipe(gulp.dest(modules === false ? esDir : libDir));
}

function compile(modules) {
    rimraf.sync(modules !== false ? libDir : esDir);

    const copyLess = gulp
        .src(["../components/**/*.less"])
        .pipe(gulp.dest(modules === false ? esDir : libDir));

    const less2css = gulp
        .src(["../components/**/*.less"])
        .pipe(less())
        .pipe(autoprefixer({ overrideBrowserslist: browserList }))
        .pipe(cssnano())
        .pipe(gulp.dest(modules === false ? esDir : libDir));

    const assets = gulp
        .src(["../components/**/*.@(png|svg)"])
        .pipe(gulp.dest(modules === false ? esDir : libDir));

    let error = 0;
    const source = [
        "../components/**/*.tsx",
        "../components/**/*.ts",
        "../components/**/*.d.ts",
        "!../components/**/__tests__/**"
    ];

    if (tsConfig.compilerOptions.allowJs) {
        source.unshift("components/**/*.jsx");
    }

    const tsResult = gulp.src(source).pipe(
        ts(tsConfig.compilerOptions, {
            error(e) {
                tsDefaultReporter.error(e);
                error = 1;
            },
            finish: tsDefaultReporter.finish
        })
    );

    function check() {
        if (error && argv["ignore-error"]) {
            process.exit(1);
        }
    }

    tsResult.on("finish", check);
    tsResult.on("end", check);

    const tsFilesStream = babelify(tsResult.js, modules);
    const tsd = tsResult.dts.pipe(gulp.dest(modules === false ? esDir : libDir));

    return merge2([less2css, tsFilesStream, tsd, assets, copyLess]);
}

gulp.task("compile-with-es", (done) => {
    console.log("[Parallel] Compile to es ...");
    compile(false).on("finish", done);
});

gulp.task("compile-with-lib", (done) => {
    console.log("[Parallel] Compile to js ...");
    compile().on("finish", done);
});

gulp.task("compile", gulp.series(gulp.parallel("compile-with-es", "compile-with-lib")));

gulp.task("dist", (done) => {
    dist(done);
});

gulp.task("default", gulp.series("dist"));
