'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

export module ZoomBar
{
    var indicator : vscode.StatusBarItem;
    var zoomOutLabel : vscode.StatusBarItem;
    var zoomInLabel : vscode.StatusBarItem;

    function getConfiguration<type>(key?: string): type
    {
        const configuration = vscode.workspace.getConfiguration("zoombar-vscode");
        return key ?
            configuration[key] :
            configuration;
    }

    export function registerCommand(context: vscode.ExtensionContext): void
    {
        zoomInLabel = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        zoomInLabel.text = "+";
        zoomInLabel.command = "zoombar-vscode.zoomIn";
        context.subscriptions.push(zoomInLabel);
        context.subscriptions.push
        (
            vscode.commands.registerCommand
            (
                'zoombar-vscode.zoomIn', zoomIn
            )
        );
        zoomInLabel.show();
        indicator = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        context.subscriptions.push(indicator);
        context.subscriptions.push
        (
            vscode.commands.registerCommand
            (
                'zoombar-vscode.update', update
            )
        );
        indicator.text = "zoom";
        indicator.show();
        zoomOutLabel = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        zoomOutLabel.text = "-";
        zoomOutLabel.command = "zoombar-vscode.zoomOut";
        context.subscriptions.push(zoomOutLabel);
        context.subscriptions.push
        (
            vscode.commands.registerCommand
            (
                'zoombar-vscode.zoomOut', zoomOut
            )
        );
        zoomOutLabel.show();
        update();
    }

    export async function update() : Promise<void>
    {
        updateIndicator(new Date());
    }
    export async function zoomOut() : Promise<void>
    {
        updateIndicator(new Date());
    }
    export async function zoomIn() : Promise<void>
    {
        updateIndicator(new Date());
    }
    export function updateIndicator(lastUpdate : Date) : void
    {
        const day = 24 *60 *60 *1000;
        const limit = lastUpdate.getTime() +day;
        const left = limit - Date.now();
        const show = getConfiguration("show");
        const text =
        (
            ("lest stamp" !== show ? lastUpdate.toLocaleString(): "")
            +" "
            +("last stamp" !== show ? leftTimeToString(left): "")
        )
        .trim();
        console.log(text);
        const color = makeLeftTimeColor((left *1.0) /(day *1.0));
        console.log(color);
        indicator.text = text;
        indicator.color = color;
        indicator.show();
    }

    export function numberToByteString(value : number) : string
    {
        if (value <= 0.0)
        {
            return "00";
        }
        if (1.0 <= value)
        {
            return "ff";
        }
        return ("00" +Math.floor(value *255).toString(16)).substr(-2);
    }
    export function makeLeftTimeColor(LeftTimeRate : number) : string
    {
        return "#"
            + numberToByteString(1.0 - LeftTimeRate)
            + numberToByteString(Math.min(0.5, LeftTimeRate))
            + numberToByteString(0.0);
    }

    function pad(value : number) : string
    {
        return (10 <= value ? "":　"0") +value.toString();
    }
    function leftTimeToString(leftTime : number) : string
    {
        if (leftTime < 0)
        {
            return "-" + leftTimeToString(-leftTime);
        }
        else
        {
            const totalSeconds = Math.floor(leftTime /1000);
            //const seconds = totalSeconds % 60;
            const totalMinutes = Math.floor(totalSeconds /60);
            const minutes = totalMinutes % 60;
            const hours = Math.floor(totalMinutes /60);
            return pad(hours) +":" +pad(minutes); //+":" +pad(seconds);
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
    ZoomBar.registerCommand(context);
}

export function deactivate() {
}