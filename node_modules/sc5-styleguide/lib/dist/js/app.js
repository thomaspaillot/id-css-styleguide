angular.module('sgApp', [
  'ui.router',
  'ngAnimate',
  'colorpicker.module',
  'hljs',
  'LocalStorageModule',
  'oc.lazyLoad',
  'ngProgress'
])
  .config(["$stateProvider", "$urlRouterProvider", "$locationProvider", "localStorageServiceProvider", "$ocLazyLoadProvider", function($stateProvider, $urlRouterProvider, $locationProvider, localStorageServiceProvider, $ocLazyLoadProvider) {
    $stateProvider
      .state('app', {
        template: '<ui-view />',
        controller: 'AppCtrl',
        abstract: true
      })
      .state('app.index', {
        templateUrl: 'views/main.html',
        controller: 'MainCtrl'
      })
      .state('app.index.overview', {
        url: '/overview',
        templateUrl: 'overview.html',
        controller: ["$rootScope", "Styleguide", function($rootScope, Styleguide) {
          $rootScope.currentSection = 'overview';
          // Update current reference to update the designer tool view
          $rootScope.currentReference.section = {
            header: 'Overview',
            reference: ''
          };

          $rootScope.$watch(function() {
            return Styleguide.config.data;
          }, function(newVal) {
            if (newVal) {
              $rootScope.pageTitle = newVal.title;
            }
          });
        }]
      })
      .state('app.index.section', {
        url: '/:section',
        templateUrl: 'views/sections.html',
        controller: 'SectionsCtrl',
        resolve: {
          loadLazyModule: ["$ocLazyLoad", function($ocLazyLoad) {
            if (window.filesConfig && window.filesConfig.length) {
              return $ocLazyLoad.load(window.filesConfig[0].name);
            }
          }]
        }
      })
      .state('app.index.variable', {
        url: '/variable/:variableName',
        templateUrl: 'views/variable-sections.html',
        controller: 'VariablesCtrl',
        resolve: {
          loadLazyModule: ["$ocLazyLoad", function($ocLazyLoad) {
            if (window.filesConfig && window.filesConfig.length) {
              return $ocLazyLoad.load(window.filesConfig[0].name);
            }
          }]
        }
      })
      .state('app.fullscreen', {
        url: '/:section/fullscreen',
        templateUrl: 'views/element-fullscreen.html',
        controller: 'ElementCtrl',
        resolve: {
          loadLazyModule: ["$ocLazyLoad", function($ocLazyLoad) {
            if (window.filesConfig && window.filesConfig.length) {
              return $ocLazyLoad.load(window.filesConfig[0].name);
            }
          }]
        }
      });

    $locationProvider.html5Mode(true);

    localStorageServiceProvider.setPrefix('sgLs');

    $ocLazyLoadProvider.config({
      events: true,
      debug: true,
      modules: window.filesConfig
    });
  }])
  .run(["$rootScope", function($rootScope) {
    $rootScope.currentReference = {
      section: {
      }
    };
  }])
  .filter('addWrapper', ['Styleguide', function(Styleguide) {
    return function(html) {
      if (Styleguide.config && Styleguide.config.data && Styleguide.config.data.commonClass) {
        return '<sg-common-class-wrapper class="' + Styleguide.config.data.commonClass + '">' + html + '</sg-common-class-wrapper>';
      }
      return html;
    };
  }])
  // Trust modifier markup to be safe html
  .filter('unsafe', ['$sce', function($sce) {
    return function(val) {
      return $sce.trustAsHtml(val);
    };
  }])
  .filter('filterRelated', function() {
    return function(variables, sectionVariableNames) {
      var filtered = [];
      angular.forEach(variables, function(variable) {
        if (sectionVariableNames && sectionVariableNames.indexOf(variable.name) > -1) {
          filtered.push(variable);
        }
      });
      return filtered;
    };
  })
  // Replaces modifier markup's {$modifiers} with modifier's modifierClass
  .filter('setModifierClass', function() {
    return function(items, modifierClass) {
      items = items.replace(/\{\$modifiers\}/g, modifierClass);
      return items;
    };
  })
  // Replace $variables with values found in variables object
  .filter('setVariables', function() {
    return function(str, variables) {
      if (!str) {
        return '';
      }
      angular.forEach(variables, function(variable) {
        str = str.replace(new RegExp('\\$' + variable.name, 'g'), variable.value);
      });
      return str;
    };
  });

'use strict';

angular.module('sgApp')
  .controller('AppCtrl', ["$scope", "ngProgress", function($scope, ngProgress) {

      // ngProgress do not respect styles assigned via CSS if we do not pass empty parameters
      // See: https://github.com/VictorBjelkholm/ngProgress/issues/33
      ngProgress.height('');
      ngProgress.color('');

      // Scroll top when page is changed
      $scope.$on('$viewContentLoaded', function() {
        window.scrollTo(0, 0);
      });

      $scope.$on('progress start', function() {
        ngProgress.start();
      });

      $scope.$on('progress end', function() {
        ngProgress.complete();
      });

      // Reload styles when server notifies about the changes
      // Add cache buster to every stylesheet on the page forcing them to reload
      $scope.$on('styles changed', function() {
        var links = Array.prototype.slice.call(document.getElementsByTagName('link'));
        links.forEach(function(link) {
          if (typeof link === 'object' && link.getAttribute('type') === 'text/css') {
            link.href = link.href.split('?')[0] + '?id=' + new Date().getTime();
          }
        });
      });

      $scope.$on('socket connected', function() {
        console.log('Socket connection established');
        //TODO: enable Designer Tool 'save changes' button?
      });

      $scope.$on('socket disconnected', function() {
        console.error('Socket connection dropped');
        //TODO: disable Designer Tool 'save changes' button?
      });

      $scope.$on('socket error', function(err) {
        console.error('Socket error:', err);
      });

    }]);

angular.module('sgApp')
  .controller('ElementCtrl', ["$scope", "$rootScope", "$stateParams", "$state", "Styleguide", "Variables", "$filter", function($scope, $rootScope, $stateParams, $state, Styleguide, Variables, $filter) {

    var section = $stateParams.section.split('-'),
      reference = section[0],
      modifier = section[1];

    $rootScope.$watch(function() {
      return Styleguide.sections.data;
    }, function() {
      updatePageData();
    });

    $rootScope.$watch(function() {
      return Styleguide.config.data;
    }, function() {
      updatePageData();
    });

    function updatePageData() {
      var sections, result, element;
      if (!Styleguide.sections.data) {
        return;
      }
      sections = Styleguide.sections.data;

      // Find correct element definition from styleguide data
      result = sections.filter(function(item) {
        return reference === item.reference;
      });

      if (result.length > 0) {
        element = result[0];

        // Set page title
        if (Styleguide.config.data) {
          var modifierStr = modifier ? '-' + modifier.toString() : '';
          $rootScope.pageTitle = element.reference + modifierStr + ' ' + element.header + ' - ' + Styleguide.config.data.title;
        }

        // Select correct modifier element if one is defined
        if (modifier) {
          element = element.modifiers[modifier - 1];
        }

        // Set the actual page content
        $scope.section = element;
        $scope.variables = Variables.variables;
        $scope.markup = $filter('setVariables')(element.wrappedMarkup, $scope.variables);
      }
    }
  }]);

'use strict';

angular.module('sgApp')
  .controller('MainCtrl', ["$scope", "$location", "$state", "Styleguide", "Variables", "localStorageService", "Socket", function($scope, $location, $state, Styleguide, Variables, localStorageService, Socket) {

    $scope.isNavCollapsed = false;
    $scope.markupSection = {isVisible: true};
    $scope.designerTool = {isVisible: false};

    localStorageService.bind($scope, 'markupSection', {isVisible: true});
    localStorageService.bind($scope, 'designerTool', {isVisible: false});

    // Bind scope variables to service updates
    $scope.sections = Styleguide.sections;
    $scope.config = Styleguide.config;
    $scope.status = Styleguide.status;
    $scope.variables = Variables.variables;

    // Bind variable to scope to wait for data to be resolved
    $scope.socketService = Socket;

    // Check if section is a main section
    $scope.filterMainSections = function(section) {
      return /^[0-9]+$/.test(section.reference);
    };

    // Toggle all markup boxes visible/hidden state
    $scope.toggleMarkup = function() {
      $scope.markupSection.isVisible = !$scope.markupSection.isVisible;
      for (var i = 0; i < $scope.sections.data.length; i++) {
        $scope.sections.data[i].showMarkup = $scope.markupSection.isVisible;
      }
    };

    // Change route to /all when searching
    $scope.$watch('search.$', function(newVal) {
      if (newVal && newVal.length > 0) {
        $location.url('all');
      }
    });

    // Clear search
    $scope.clearSearch = function() {
      if ($scope.search) {
        $scope.search = {};
      }
    };

  }]);

angular.module('sgApp')
  .controller('SectionsCtrl', ["$scope", "$stateParams", "$location", "$state", "$rootScope", "Styleguide", function($scope, $stateParams, $location, $state, $rootScope, Styleguide) {

    if ($stateParams.section) {
      $scope.currentSection = $stateParams.section;
      $rootScope.currentSection = $scope.currentSection;
    } else {
      $location.url('overview');
    }

    $rootScope.$watch(function() {
      return Styleguide.sections.data;
    }, function() {
      setPageTitle($scope.currentSection);
    });

    $rootScope.$watch(function() {
      return Styleguide.config.data;
    }, function() {
      setPageTitle($scope.currentSection);
    });

    function setPageTitle(section) {
      if (!Styleguide.config.data || !Styleguide.sections.data) {
        return;
      }
      if (section === 'all') {
        $rootScope.pageTitle = 'All sections - ' + Styleguide.config.data.title;
      } else {
        var result = Styleguide.sections.data.filter(function(item) {
          return item.reference === section;
        });
        if (result.length > 0) {
          var element = result[0];
          $rootScope.pageTitle = element.reference + ' ' + element.header + ' - ' + Styleguide.config.data.title;
        }
      }
    }

    $scope.isEmptyMainSection = function(section) {
      return section.reference.indexOf('.') === -1 && !section.wrappedMarkup && (!section.modifiers || section.modifiers.length === 0);
    };

    $scope.isActive = function(section) {
      return section.reference === $rootScope.currentReference.section.reference ? 'active' : '';
    };

    $scope.filterSections = function(section) {
      if ($scope.currentSection === 'all') {
        return true;
      }
      return new RegExp('^' + $scope.currentSection).test(section.reference);
    };
  }]);

angular.module('sgApp')
  .controller('VariablesCtrl', ["$rootScope", "$scope", "$stateParams", "$location", "Styleguide", function($rootScope, $scope, $stateParams, $location, Styleguide) {

    $rootScope.currentSection = '';
    $scope.clearSearch();

    if ($stateParams.variableName) {
      $scope.currentVariable = $stateParams.variableName;
    } else {
      $location.url('overview');
    }

    $scope.getLevel = function() {
      return 'sub';
    };

    findSectionsUsingVariable();

    $rootScope.$on('styles changed', findSectionsUsingVariable);

    function findSectionsUsingVariable() {
      var sections = Styleguide.sections;
      if (sections && sections.data) {
        $scope.relatedSections = sections.data.filter(function(section) {
          return section.variables && section.variables.indexOf($scope.currentVariable) >= 0;
        });
      } else {
        $scope.relatedSections = [];
      }
    }

  }]);

'use strict';

angular.module('sgApp')
  .directive('sgDesign', ["Variables", function(Variables) {
    return {
      replace: true,
      restrict: 'A',
      templateUrl: 'views/partials/design.html',
      link: function(scope) {
        var parentRef;

        function isSubSection(section) {
          var ref = section.parentReference;
          return (typeof ref === 'string') &&
            (ref === parentRef || ref.substring(0, ref.indexOf('.')) === parentRef);
        }

        function getVariables(section) {
          return section.variables;
        }

        function concat(a, b) {
          return a.concat(b);
        }

        function unique(a, idx, arr) {
          return a !== undefined && arr.indexOf(a) === idx;
        }

        scope.showRelated = true;

        scope.$watch('currentReference.section', function() {
          var relatedVariables = scope.currentReference.section.variables || [];
          if (scope.showRelated && relatedVariables.length === 0 && scope.sections.data) {
            parentRef = scope.currentReference.section.reference;
            scope.relatedChildVariableNames = scope.sections.data.filter(isSubSection)
              .map(getVariables)
              .reduce(concat, [])
              .filter(unique);
          }
        });

        scope.saveVariables = function() {
          Variables.saveVariables();
        };

        scope.resetLocal = function() {
          Variables.resetLocal();
        };

        scope.dirtyVariablesFound = function() {
          return Variables.variables.some(function(variable) {
            return variable.dirty && variable.dirty === true;
          });
        };

      }
    };
  }]);

'use strict';

angular.module('sgApp')
  .directive('dynamicCompile', ["$compile", "$parse", function($compile, $parse) {
    return {
      link: function(scope, element, attrs) {
        var parsed = $parse(attrs.ngBindHtml);
        function getStringValue() { return (parsed(scope) || '').toString(); }
        // Recompile if the template changes
        scope.$watch(getStringValue, function() {
          $compile(element, null, 0)(scope);
        });
      }
    };
  }]);

'use strict';

angular.module('sgApp')
  .directive('sgScopeUserStyles', function() {
    return {
      link: function(scope, element) {
        var host = element[0],
            content = host.innerHTML;

        if (typeof host.createShadowRoot === 'function') {
          var root = host.createShadowRoot(),
              style = [
                '<style>',
                '@import url(\'styleguide.css\');',
                '@import url(\'styleguide_pseudo_styles.css\');',
                '@import url(\'css/styleguide_helper_elements.css\');',
                '</style>'
              ].join('\n');

          scope.$watch(function() {
            return element[0].innerHTML;
          }, function(newVal) {
            root.innerHTML = style + newVal;
          });
          root.innerHTML = style + content;
        } else {
          host.innerHTML = content;
        }
      }
    };
  });

'use strict';

angular.module('sgApp')
  .directive('sgSection', ["$rootScope", "$window", "$timeout", function($rootScope, $window, $timeout) {
    return {
      replace: true,
      restrict: 'A',
      templateUrl: 'views/partials/section.html',
      link: function(scope, element) {
        function updateCurrentReference() {
          var topOffset = element[0].offsetTop,
            bottomOffset = element[0].offsetTop + element[0].offsetHeight,
            buffer = 50;

          if ($window.pageYOffset > topOffset - buffer && $window.pageYOffset < bottomOffset - buffer) {
            if ($rootScope.currentReference.section.reference !== scope.section.reference) {

              // Assign new current section
              $rootScope.currentReference.section = scope.section;
              if (!scope.$$phase) {
                $rootScope.$apply();
              }
            }
          }
        }

        // Init markup visibility based on global setting
        scope.section.showMarkup = scope.markupSection.isVisible;
        // By default do not show CSS markup
        scope.section.showCSS = false;

        // Listen to scroll events and update currentReference if this section is currently focused
        angular.element($window).bind('scroll', function() {
          updateCurrentReference();
        });

        scope.$watch('search.$', function() {
          // Search is not processed completely yet
          // We want to run updateCurrentReference after digest is complete
          $timeout(function() {
            updateCurrentReference();
          });
        });

        // Section location will change still after initialzation
        // We want to run updateCurrentReference after digest is complete
        $timeout(function() {
          updateCurrentReference();
        });
      }
    };
  }]);

'use strict';

angular.module('sgApp')
  .directive('sgVariable', function() {
    return {
      replace: true,
      restrict: 'A',
      templateUrl: 'views/partials/variable.html',
      link: function(scope) {
        var colorRegex = /#[0-9a-f]{3,6}/i;
        scope.color = {};

        function shorthandFormat(str) {
          if (str.length === 7 && str[0] === '#' && str[1] === str[2] && str[3] === str[4] && str[5] === str[6]) {
            return '#' + str[1] + str[3] + str[5];
          }
          return str;
        }

        function extendedFormat(str) {
          if (str.length === 4 && str[0] === '#') {
            return '#' + str[1] + str[1] + str[2] + str[2] + str[3] + str[3];
          }
          return str;
        }

        function findColor(str) {
          var match = colorRegex.exec(str);
          if (match) {
            return match[0];
          }
        }

        scope.hasColor = function(value) {
          return colorRegex.test(value);
        };

        // Parse first color from the string
        scope.$watch(function() {
          return scope.variable.value;
        }, function() {
          var color = findColor(scope.variable.value);
          if (color) {
            // Store original format. This is needed when we store value back
            scope.color.useShorthand = (color.length === 4);
            // Since color picker does not support compact format we need to always extend it
            scope.color.value = extendedFormat(color);
          }
        });

        // Set changed color back to the string
        scope.$watch(function() {
          return scope.color.value;
        }, function(newVal) {
          var color = newVal;
          // If color was originally stored in the compact format try to convert it
          if (scope.color.useShorthand) {
            color = shorthandFormat(color);
          }
          scope.variable.value = scope.variable.value.replace(colorRegex, color);
        });
      }
    };
  });

angular.module('sgApp')
  .service('Socket', ["$rootScope", "$window", function($rootScope, $window) {

    'use strict';

    var socket,
      connected = false,
      service = {

        isAvailable: function() {
          return (typeof window.io !== 'undefined');
        },
        on: function(eventName, listener) {
          if (socket) {
            socket.on(eventName, function() {
              var args = arguments;
              $rootScope.$apply(function() {
                listener.apply(undefined, args);
              });
            });
          }
        },

        emit: function(eventName, data, callback) {
          if (socket) {
            socket.emit(eventName, data, function() {
              var args = arguments;
              $rootScope.$apply(function() {
                if (callback) {
                  callback.apply(undefined, args);
                }
              });
            });
          }
        },

        isConnected: function() {
          return connected;
        }
    };

    if (service.isAvailable()) {
      socket = $window.io.connect('/');

      service.on('connect', function() {
        connected = true;
        $rootScope.$broadcast('socket connected');
      });

      service.on('disconnect', function() {
        connected = false;
        $rootScope.$broadcast('socket disconnected');
      });

      service.on('error', function(err) {
        $rootScope.$broadcast('socket error', err);
      });
    }

    return service;

  }]);

/*
 * Styleguide.js
 *
 * Handles styleguide data
 */

'use strict';

angular.module('sgApp')
  .service('Styleguide', ["$http", "$rootScope", "Socket", function($http, $rootScope, Socket) {

    var _this = this;

    this.sections = {};
    this.config = {};
    this.variables = {};
    this.status = {
      hasError: false,
      error: {}
    };

    this.get = function() {
      return $http({
        method: 'GET',
        url: 'styleguide.json'
      }).success(function(response) {
        _this.config.data = response.config;
        _this.variables.data = response.variables;
        _this.sections.data = response.sections;
      });
    };

    Socket.on('styleguide compile error', function(err) {
      _this.status.hasError = true;
      _this.status.error = err;
    });

    Socket.on('styleguide compile success', function() {
      _this.status.hasError = false;
    });

    $rootScope.$on('styles changed', function() {
      _this.get();
    });

    // Get initial data
    this.get();
  }]);

(function() {

  'use strict';

  var Variables = function(Styleguide, $q, $rootScope, Socket) {

    // Server data contains data initially load from the server
    var _this = this, serverData = [];
    // variables contain the actual data passed outside the service
    // variables could not contain any keys that does not exist in the serverData object
    this.variables = [];

    $rootScope.$watch(function() {
      return _this.variables;
    }, function() {
      _this.refreshDirtyStates();
    }, true);

    this.variableMatches = function(var1, var2) {
      return var1.name === var2.name && var1.file === var2.file;
    };

    this.getLocalVar = function(variable) {
      for (var i = this.variables.length - 1; i >= 0; i--) {
        if (this.variableMatches(this.variables[i], variable)) {
          return this.variables[i];
        }
      }
    };

    this.getLocalIndex = function(variable) {
      for (var i = this.variables.length - 1; i >= 0; i--) {
        if (this.variableMatches(this.variables[i], variable)) {
          return i;
        }
      }
    };

    this.getServerVar = function(variable) {
      for (var i = serverData.length - 1; i >= 0; i--) {
        if (this.variableMatches(serverData[i], variable)) {
          return serverData[i];
        }
      }
    };

    this.refreshDirtyStates = function() {
      var _this = this;
      // Mark variables that differ from the server version as dirty
      angular.forEach(_this.variables, function(variable) {
        var serverVar = _this.getServerVar(variable);
        if (serverVar && serverVar.value !== variable.value && !variable.dirty) {
          variable.dirty = true;
        } else if (serverVar && serverVar.value === variable.value && variable.dirty) {
          delete variable.dirty;
        }
      });
    };

    this.refreshValues = function() {
      if (serverData.length === 0) {
        this.variables = [];
      } else {
        for (var i = 0; i < serverData.length; i++) {
          var oldIndex;
          if (this.variables[i] && !this.variableMatches(this.variables[i], serverData[i])) {
            if (!this.getServerVar(this.variables[i])) {
              // This variable does not exists anymore on the server. Remove it
              this.variables.splice(i, 1);
            } else if (this.getLocalVar(serverData[i]) && !this.getLocalVar(serverData[i]).dirty) {
              // The variable already exists but in another position
              // It is not changed so we can just remove it
              oldIndex = this.getLocalIndex(serverData[i]);
              this.variables.splice(oldIndex, 1);
              this.variables.splice(i, 0, angular.copy(serverData[i]));
            } else if (this.getLocalVar(serverData[i])) {
              // The variable already exists but in another position
              // It is changed so we need to keep the old values
              oldIndex = this.getLocalIndex(serverData[i]);
              var oldValue = this.variables[oldIndex].value;
              this.variables.splice(oldIndex, 1);
              var newObject = angular.copy(serverData[i]);
              newObject.value = oldValue;
              this.variables.splice(i, 0, newObject);
            } else {
              // The variable does not exists anywhere else. Just add it
              this.variables.splice(i, 0, angular.copy(serverData[i]));
            }
          } else if (this.variables[i] && this.variableMatches(this.variables[i], serverData[i])) {
            // Variable exists already locally
            // Update value if variable does not have any local changes
            if (!this.variables[i].dirty) {
              this.variables[i].value = serverData[i].value;
            }
          } else if (!this.variables[i]) {
            // Add new local variable
            this.variables.push(angular.copy(serverData[i]));
          }
        }
      }
    };

    this.resetLocal = function() {
      var _this = this;
      // Reset every key to corresponding server value
      angular.forEach(this.variables, function(variable) {
        var serverVar = _this.getServerVar(variable);
        if (serverVar) {
          variable.value = serverVar.value;
        }
      });
    };

    this.setSocket = function(newSocket) {
      this.socket = newSocket;
      if (this.socket) {
        this.addSocketListeners();
      }
      return this;
    };

    this.addSocketListeners = function() {
      this.socket.on('styleguide progress start', function() {
        $rootScope.$broadcast('progress start');
      });
      this.socket.on('styleguide progress end', function() {
        $rootScope.$broadcast('progress end');
        $rootScope.$broadcast('styles changed');
      });
    };

    this.saveVariables = function() {
      if (this.socket) {
        this.socket.emit('variables to server', this.getDirtyVariables());
      } else {
        throw new Error('Socket not available');
      }
    };

    this.getDirtyVariables = function() {
      return this.variables.filter(function(variable) {
        return variable.dirty && variable.dirty === true;
      });
    };

    // Start constructor
    this.init = function(socket) {
      var _this = this;
      this.setSocket(socket);

      // Update new server data when it is available
      $rootScope.$watch(function() {
        return Styleguide.variables.data;
      }, function(newValue) {
        if (newValue) {
          serverData = newValue;
          _this.refreshValues();
          _this.refreshDirtyStates();
        }
      });
    };

    // Run constructor
    this.init(Socket);
  };
  Variables.$inject = ["Styleguide", "$q", "$rootScope", "Socket"];

  angular.module('sgApp').service('Variables', Variables);
}());
