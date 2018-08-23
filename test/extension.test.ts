//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
//import * as vscode from 'vscode';
import * as ZoomBar from '../src/extension';

// Defines a Mocha test suite to group tests of similar kind together
suite("Extension Tests", () => {

    // Defines a Mocha unit test
    test("zoombar", () => {
        assert.equal(100 * 100, Math.round(ZoomBar.ZoomBar.levelToPercent(0.0) *100.0));
        assert.equal(120 * 100, Math.round(ZoomBar.ZoomBar.levelToPercent(1.0) *100.0));
        assert.equal(144 * 100, Math.round(ZoomBar.ZoomBar.levelToPercent(2.0) *100.0));
        assert.equal(0.0 * 100, Math.round(ZoomBar.ZoomBar.percentToLevel(100.0) *100.0));
        assert.equal(1.0 * 100, Math.round(ZoomBar.ZoomBar.percentToLevel(120.0) *100.0));
        assert.equal(2.0 * 100, Math.round(ZoomBar.ZoomBar.percentToLevel(144.0) *100.0));
    });
});