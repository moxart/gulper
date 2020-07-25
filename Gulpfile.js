'use strict';

var gulp = require('gulp');
var sass = require('gulp-sass');
var less = require('gulp-less');
var gulpif = require('gulp-if');
var lazypipe = require('lazypipe');
var notify = require('gulp-notify');
var notify = require("gulp-notify");
var concat = require('gulp-concat');
var jshint = require('gulp-jshint');
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');
var minfiy = require('gulp-minify');
var rename = require('gulp-rename');
var merge  = require('merge-stream');
var flatten = require('gulp-flatten');
var cssnano = require('gulp-cssnano');
var plumber = require('gulp-plumber');
var changed  = require('gulp-changed');
var imagemin = require('gulp-imagemin');
var uglifycss = require('gulp-uglifycss');
var runSequence = require('run-sequence');
var sourcemaps = require('gulp-sourcemaps');
var autoprefixer = require('gulp-autoprefixer');

// https://github.com/austinpray/asset-builder
var manifest = require('asset-builder')('./assets/manifest.json');

// path.source >>> assets/
// path.dist >>> dist/
var path = manifest.paths;

// project.js & project.css
var project = manifest.getProjectGlobs();

// CSS processing pipeline
var cssMixed = function (filename) {
  return lazypipe()
    .pipe(function () {
      return plumber();
    })
    .pipe(function () {
      return gulpif('*.scss', sass({
        outputStyle: 'nested'
      })
      .on('error', sass.logError))
    })
    .pipe(function () {
      return gulpif('*.less', less())
    })
    .pipe(concat, filename)
    .pipe(autoprefixer, {
      browsers: ['last 2 versions'],
      cascade: false
    })
    .pipe(cssnano)
    .pipe(function () {
      return sourcemaps.init();
    })
    .pipe(function() {
      return uglifycss({
        "uglyComments": true
      });
    })
    .pipe(function () {
      return rename({
        suffix: '.min'
      })
    })
    .pipe(function () {
      return sourcemaps.write('.', {
        sourceRoot: 'assets/styles/'
      });
    })();
};

// JS processing pipeline
var jsMixed = function (filename) {
  return lazypipe()
    .pipe(function () {
      return sourcemaps.init();
    })
    .pipe(jshint, function () {
      return notify(function (file) {
        if (file.jshint.success) {
          return false;
        }
      })
    })
    .pipe(function () {
      return uglify({
        compress: true
      })
    })
    .pipe(concat, filename)
    .pipe(function () {
      return sourcemaps.write('.', {
        sourceRoot: 'assets/scripts/'
      });
    })
    .pipe(function () {
      return rename({
        suffix: '.min'
      })
    })();
};

// gulp styles
gulp.task('styles', ['wiredep'], function () {
  var merged = merge();

  manifest.forEachDependency('css', function(dep) {
    var cssTasks = cssMixed(dep.name);
    cssTasks.on("error", notify.onError("Error: <%= error.message %>"));

    merged.add(
      gulp.src(dep.globs, { base: 'styles' })
        .pipe(cssTasks)
    );

  });

  return merged
    .pipe(gulp.dest(path.dist + 'styles'))
});

// gulp scripts
gulp.task('scripts', ['jshint'], function() {
  var merged = merge();

  manifest.forEachDependency('js', function(dep) {
    merged.add(
      gulp.src(dep.globs, {base: 'scripts'})
        .pipe(jsMixed(dep.name).on("error", notify.onError("Error: <%= error.message %>")))
    );
  });

  return merged
    .pipe(gulp.dest(path.dist + 'scripts'))
});

// gulp fonts
gulp.task('fonts', function() {
  return gulp.src(path.source + 'fonts/**/*')
    .pipe(flatten())
    .pipe(gulp.dest(path.dist + 'fonts'))
});

// gulp images
gulp.task('images', function () {
  return gulp.src(path.source + 'images/*')
    .pipe(imagemin({
      progressive: true,
      interlaced: true,
      svgoPlugins: [{removeUnknownsAndDefaults: false}, {cleanupIDs: false}]
    }))
    .pipe(gulp.dest(path.dist + 'images'))
});

// gulp lint - Lints configuration JSON and project JS.
gulp.task('jshint', function() {
  return gulp.src([
      'bower.json', 'gulpfile.js'
    ].concat(project.js))
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));
});


// gulp watch - When a modification is made to an asset, run the
// build step for that asset and inject the changes into the page.
gulp.task('watch', function () {
  gulp.watch([path.source + 'styles/**/*'], ['styles']);
  gulp.watch([path.source + 'scripts/**/*'], ['jshint', 'scripts']);
  gulp.watch([path.source + 'fonts/**/*'], ['fonts']);
  gulp.watch([path.source + 'images/**/*'], ['images']);
});

// gulp clean - Deletes the dist directory
gulp.task('clean', require('del').bind(null, [path.dist]));

// https://github.com/taptapship/wiredep
// Automatically injected Bower dependencies via wiredep
gulp.task('wiredep', function() {
  var wiredep = require('wiredep').stream;
  return gulp.src(project.css)
    .pipe(wiredep())
    .pipe(changed(path.source + 'styles', {
      hasChanged: changed.compareSha1Digest
    }))
    .pipe(gulp.dest(path.source + 'styles'));
});

// gulp build - Run all the build tasks but don't clean up beforehand.
// Generally you should be running `gulp` instead of `gulp build`.
gulp.task('build', function(callback) {
  runSequence('styles', 'scripts', ['fonts', 'images'], callback);
});

// gulp - compile for production run
gulp.task('default', ['clean'], function() {
  gulp.start('build');
});
