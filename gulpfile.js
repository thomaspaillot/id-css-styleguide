var gulp = require('gulp'),
    styleguide = require('sc5-styleguide'),
    outputPath = 'styleguide';
    source = 'id-css-starter-kit/assets/**/*.scss';

gulp.task('styleguide', function() {
  return gulp.src(source)
    .pipe(styleguide({
      title: 'Intactile styleguide',
      overviewPath: 'README.md',
      server: true,
      rootPath: outputPath,
      styleVariables: 'id-css-starter-kit/assets/core/_variables.scss',
      sass: {
        src: 'id-css-starter-kit/assets/style.scss'
      }
    }))
    .pipe(gulp.dest(outputPath));
});

gulp.task('styleguide-watch', ['styleguide'], function() {
  gulp.watch(source, ['styleguide']);
});