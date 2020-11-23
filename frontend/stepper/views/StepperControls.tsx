import React, {ReactElement} from "react";
import {Button, ButtonGroup, Intent} from "@blueprintjs/core";

interface StepperControlsProps {
    showStepper: any,
    getMessage: any,
    showControls: any,
    showEdit: any,
    showCompile: any,
    compileOrExecuteMessage: any,
    controls: any,
    dispatch: Function,
    canInterrupt: boolean,
    canStep: boolean,
    canExit: boolean,
    canStepOut: boolean,
    canCompile: boolean,
    canRestart: boolean,
    canUndo: boolean,
    canRedo: boolean,
    showExpr:  boolean
}

export class StepperControls extends React.PureComponent<StepperControlsProps> {
    render = () => {
        const {showStepper} = this.props;
        if (!showStepper)
            return false;
        const {getMessage, showControls, showEdit, showCompile, compileOrExecuteMessage} = this.props;

        return (
            <div className="controls controls-stepper">
                <div className="controls-stepper-wrapper">
                    {showControls && <ButtonGroup className="controls-stepper-execution">
                        {this._button('run', this.onStepRun, getMessage('CONTROL_RUN'), <i
                            className="bp3-icon fi fi-run"/>)}
                        {this._button('expr', this.onStepExpr, getMessage('CONTROL_EXPR'), <i
                            className="bp3-icon fi fi-step-expr"/>)}
                        {this._button('into', this.onStepInto, getMessage('CONTROL_INTO'), <i
                            className="bp3-icon fi fi-step-into"/>)}
                        {this._button('out', this.onStepOut, getMessage('CONTROL_OUT'), <i
                            className="bp3-icon fi fi-step-out"/>)}
                        {this._button('over', this.onStepOver, getMessage('CONTROL_OVER'), <i
                            className="bp3-icon fi fi-step-over"/>)}
                        {this._button('interrupt', this.onInterrupt, getMessage('CONTROL_INTERRUPT'), <i
                            className="bp3-icon fi fi-interrupt"/>)}
                        {this._button('restart', this.onRestart, getMessage('CONTROL_RESTART'), <i
                            className="bp3-icon fi fi-restart"/>)}
                        {this._button('undo', this.onUndo, getMessage('CONTROL_UNDO'), 'undo')}
                        {this._button('redo', this.onRedo, getMessage('CONTROL_REDO'), 'redo')}
                    </ButtonGroup>}
                </div>
                <div className="controls-compile">
                    {showEdit && this._button('edit', this.onEdit, false, false, getMessage('EDIT'))}
                    {showCompile && this._button('compile', this.onCompile, false, false, compileOrExecuteMessage)}
                </div>
            </div>
        );
    };

    _button = (key: string, onClick: Function, title: string, icon: string, text?: string): ReactElement => {
        const {controls} = this.props;

        let disabled = false;
        const style = {};

        let intent: string = Intent.NONE;
        if (key === 'compile') {
            intent = Intent.PRIMARY;
        }

        switch (key) {
            case 'interrupt':
                disabled = !this.props.canInterrupt;
                break;
            case 'restart':
                disabled = !this.props.canRestart;
                break;
            case 'undo':
                disabled = !this.props.canUndo;
                break;
            case 'redo':
                disabled = !this.props.canRedo;
                break;
            case 'run':
                disabled = !this.props.canStep;

                break;
            case 'into':
                disabled = !this.props.canStep;
                break;
            case 'over':
                disabled = !this.props.canStep;

                break;
            case 'expr':
                disabled = !this.props.canStep;

                if (!this.props.showExpr) {
                    style.display = 'none';
                }

                break;
            case 'out':
                disabled = !(this.props.canStep && this.props.canStepOut);
                break;
            case 'edit':
                disabled = !this.props.canExit;
                break;
            case 'compile':
                disabled = !this.props.canCompile;
                break;
        }

        if (controls) {
            const mod = controls[key];
            if (mod === '_') {
                return false;
            }
            if (mod === '-') {
                disabled = true;
            }
            if (mod) {
                intent = mod === '+' ? Intent.PRIMARY : Intent.NONE;
            }
        }

        if (title === false) {
            title = undefined;
        }

        return (
            <Button
                onClick={onClick}
                style={style}
                disabled={disabled}
                intent={intent}
                title={title}
                icon={icon}
                text={text}
            />
        );
    };

    onStepRun = () => this.props.dispatch({type: deps.stepperStep, payload: {mode: 'run'}});
    onStepExpr = () => this.props.dispatch({type: deps.stepperStep, payload: {mode: 'expr'}});
    onStepInto = () => this.props.dispatch({type: deps.stepperStep, payload: {mode: 'into'}});
    onStepOut = () => this.props.dispatch({type: deps.stepperStep, payload: {mode: 'out'}});
    onStepOver = () => this.props.dispatch({type: deps.stepperStep, payload: {mode: 'over'}});
    onInterrupt = () => this.props.dispatch({type: deps.stepperInterrupt, payload: {}});
    onRestart = () => this.props.dispatch({type: deps.stepperRestart, payload: {}});
    onEdit = () => this.props.dispatch({type: deps.stepperExit, payload: {}});
    onUndo = () => this.props.dispatch({type: deps.stepperUndo, payload: {}});
    onRedo = () => this.props.dispatch({type: deps.stepperRedo, payload: {}});
    onCompile = () => this.props.dispatch({type: deps.compile, payload: {}});
}
