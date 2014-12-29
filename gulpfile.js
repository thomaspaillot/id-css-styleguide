var gulp = require('gulp'),
    styleguide = require('sc5-styleguide'),
    outputPath = 'styleguide';
    source = 'src/assets/**/*.scss';

gulp.task('styleguide', function() {
  return gulp.src(source)
    .pipe(styleguide({
      title: 'Intactile styleguide',
      server: true,
      rootPath: outputPath,
      styleVariables: 'src/assets/core/_variables.scss',
      sass: {
        src: 'src/assets/style.scss'
      }
    }))
    .pipe(gulp.dest(outputPath));
});

gulp.task('styleguide-watch', ['styleguide'], function() {
  gulp.watch(source, ['styleguide']);
});