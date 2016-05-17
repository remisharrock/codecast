
import React from 'react';
import ReactDOM from 'react-dom';
import EpicComponent from 'epic-component';
import {Provider} from 'react-redux';
import Immutable from 'immutable';
import queryString from 'query-string';

import 'brace';
// For jspm bundle-sfx, ensure that jspm-0.16.config.js has a meta entry
// listing brace as a dependency for each of these modules, otherwise the
// bundle will complain about an undefined "ace" global variable.
import 'brace/worker/javascript';
import 'brace/mode/c_cpp';
import 'brace/theme/github';

import 'bootstrap/css/bootstrap.min.css!';
import 'font-awesome/css/font-awesome.min.css!';
import '../common/style.css!';

import {link, use, addReducer, include, defineSelector, defineView} from '../utils/linker';

import stepperComponent from '../stepper/index';
import commonComponent from '../common/index';

const qs = queryString.parse(window.location.search);

const {store, scope, start} = link(function* (deps) {
  yield addReducer('init', _ => Immutable.Map());
  yield include(stepperComponent);
  yield include(commonComponent);
  yield use('StepperControls', 'FullscreenButton', 'MainView', 'ExamplePicker', 'isTranslated');
  yield defineSelector('AppSelector', function (state) {
    const isTranslated = deps.isTranslated(state);
    return {isTranslated};
  });
  yield defineView('App', 'AppSelector', EpicComponent(self => {
    self.render = function () {
      const {isTranslated} = self.props;
      return (
        <div className="container">
          <div className="row">
            <div className="col-md-12">
              <div className="pane pane-controls clearfix">
                <deps.StepperControls enabled={true}/>
                <deps.FullscreenButton/>
                <deps.ExamplePicker disabled={isTranslated}/>
              </div>
            </div>
          </div>
          <deps.MainView/>
        </div>
      );
    };
  }));
});
store.dispatch({type: scope.init});
store.dispatch({type: scope.sourceLoad, text: qs.source||''});
store.dispatch({type: scope.inputLoad, text: qs.input||''});
start();

const container = document.getElementById('react-container');
ReactDOM.render(<Provider store={store}><scope.App/></Provider>, container);
