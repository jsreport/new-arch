/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
	
	var _react = __webpack_require__(1);
	
	var _jsreportStudio = __webpack_require__(2);
	
	var _jsreportStudio2 = _interopRequireDefault(_jsreportStudio);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
	
	function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }
	
	function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }
	
	var FreezeModal = function (_Component) {
	  _inherits(FreezeModal, _Component);
	
	  function FreezeModal() {
	    _classCallCheck(this, FreezeModal);
	
	    return _possibleConstructorReturn(this, (FreezeModal.__proto__ || Object.getPrototypeOf(FreezeModal)).apply(this, arguments));
	  }
	
	  _createClass(FreezeModal, [{
	    key: 'freeze',
	    value: function freeze() {
	      _jsreportStudio2.default.setSetting('freeze', true);
	      this.props.close();
	    }
	  }, {
	    key: 'render',
	    value: function render() {
	      var _this2 = this;
	
	      return React.createElement(
	        'div',
	        null,
	        React.createElement(
	          'h2',
	          null,
	          'Freeze changes'
	        ),
	        React.createElement(
	          'p',
	          null,
	          'The freeze mode will block accidental changes in entities like templates.',
	          React.createElement('br', null),
	          'The only permitted operations in freeze mode are persisting logs and output reports.',
	          React.createElement('br', null),
	          'The freeze mode can be switched back to normal using the menu command "Release freeze".'
	        ),
	        React.createElement(
	          'div',
	          { className: 'button-bar' },
	          React.createElement(
	            'button',
	            { className: 'button confirmation', onClick: function onClick() {
	                return _this2.freeze();
	              } },
	            'Freeze'
	          )
	        )
	      );
	    }
	  }]);
	
	  return FreezeModal;
	}(_react.Component);
	
	var ReleaseFreezeModal = function (_Component2) {
	  _inherits(ReleaseFreezeModal, _Component2);
	
	  function ReleaseFreezeModal() {
	    _classCallCheck(this, ReleaseFreezeModal);
	
	    return _possibleConstructorReturn(this, (ReleaseFreezeModal.__proto__ || Object.getPrototypeOf(ReleaseFreezeModal)).apply(this, arguments));
	  }
	
	  _createClass(ReleaseFreezeModal, [{
	    key: 'release',
	    value: function release() {
	      _jsreportStudio2.default.setSetting('freeze', false);
	      this.props.close();
	    }
	  }, {
	    key: 'render',
	    value: function render() {
	      var _this4 = this;
	
	      return React.createElement(
	        'div',
	        null,
	        React.createElement(
	          'h2',
	          null,
	          'Release freeze'
	        ),
	        React.createElement(
	          'p',
	          null,
	          'This will switch the editing mode to normal.'
	        ),
	        React.createElement(
	          'div',
	          { className: 'button-bar' },
	          React.createElement(
	            'button',
	            { className: 'button confirmation', onClick: function onClick() {
	                return _this4.release();
	              } },
	            'Release'
	          )
	        )
	      );
	    }
	  }]);
	
	  return ReleaseFreezeModal;
	}(_react.Component);
	
	var freeze = function freeze() {
	  _jsreportStudio2.default.openModal(FreezeModal);
	};
	
	var release = function release() {
	  _jsreportStudio2.default.openModal(ReleaseFreezeModal);
	};
	
	_jsreportStudio2.default.initializeListeners.push(function () {
	  if (_jsreportStudio2.default.authentication && !_jsreportStudio2.default.authentication.user.isAdmin) {
	    return;
	  }
	
	  _jsreportStudio2.default.addToolbarComponent(function () {
	    return _jsreportStudio2.default.getSettingValueByKey('freeze', false) ? React.createElement('span', null) : React.createElement(
	      'div',
	      {
	        className: 'toolbar-button', onClick: freeze },
	      React.createElement('i', { className: 'fa fa-lock' }),
	      'Freeze edits'
	    );
	  }, 'settings');
	
	  _jsreportStudio2.default.addToolbarComponent(function () {
	    return _jsreportStudio2.default.getSettingValueByKey('freeze', false) ? React.createElement(
	      'div',
	      {
	        className: 'toolbar-button', onClick: release },
	      React.createElement('i', { className: 'fa fa-unlock' }),
	      'Release freeze'
	    ) : React.createElement('span', null);
	  }, 'settings');
	});

/***/ },
/* 1 */
/***/ function(module, exports) {

	module.exports = Studio.libraries['react'];

/***/ },
/* 2 */
/***/ function(module, exports) {

	module.exports = Studio;

/***/ }
/******/ ]);