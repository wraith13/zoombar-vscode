import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as ZoomBar from '../../extension';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test("zoombar", () => {
        assert.equal(100.0, ZoomBar.ZoomBar.roundZoom(99.999));
        assert.equal(100.0, ZoomBar.ZoomBar.roundZoom(100.000));
        assert.equal(100.0, ZoomBar.ZoomBar.roundZoom(100.001));
        assert.equal(100.0, ZoomBar.ZoomBar.roundZoom(ZoomBar.ZoomBar.levelToPercent(0.0)));
        assert.equal(120.0, ZoomBar.ZoomBar.roundZoom(ZoomBar.ZoomBar.levelToPercent(1.0)));
        assert.equal(144.0, ZoomBar.ZoomBar.roundZoom(ZoomBar.ZoomBar.levelToPercent(2.0)));
        assert.equal(0.0, ZoomBar.ZoomBar.roundZoom(ZoomBar.ZoomBar.percentToLevel(100.0)));
        assert.equal(1.0, ZoomBar.ZoomBar.roundZoom(ZoomBar.ZoomBar.percentToLevel(120.0)));
        assert.equal(2.0, ZoomBar.ZoomBar.roundZoom(ZoomBar.ZoomBar.percentToLevel(144.0)));
        assert.equal("100%", ZoomBar.ZoomBar.percentToDisplayString(100.0, "ja-JP"));
        assert.equal("1,000%", ZoomBar.ZoomBar.percentToDisplayString(1000.0, "ja-JP"));
    });
});
