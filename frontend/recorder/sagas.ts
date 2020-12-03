/* TODO: figure out why the 'end' event seems to be inserted when the recording
         is paused, not when the recording is actually stopped
         => because 'end' is added by recorderStopping
*/

import {call, delay, put, race, select, take, takeEvery, takeLatest} from 'redux-saga/effects';

import {RECORDING_FORMAT_VERSION} from '../version';
import {spawnWorker} from '../utils/worker_utils';
// @ts-ignore
import AudioWorker from '../audio_worker/index.worker';
// import AudioWorker from 'worker-loader?inline!../audio_worker';
import {ActionTypes} from "./actionTypes";
import {ActionTypes as CommonActionTypes} from '../common/actionTypes';
import {ActionTypes as PlayerActionTypes} from '../player/actionTypes';
import {getPlayerState} from "../player/selectors";
import {getRecorderState} from "./selectors";

export default function(bundle, deps) {
    bundle.use('recordApi');

    function* recorderPrepare() {
        try {
            /* Show 'record' screen to user. */
            yield put({type: CommonActionTypes.SystemSwitchToScreen, payload: {screen: 'record'}});

            // Clean up any previous audioContext and worker.
            const recorder = yield select(getRecorderState);
            let recorderContext = recorder.get('context');
            if (recorderContext) {
                const {worker: oldWorker} = recorderContext;
                // @ts-ignore
                if (oldContext) {
                    // @ts-ignore
                    oldContext.close();
                }
                if (oldWorker) {
                    yield call(oldWorker.kill);
                }
                // TODO: put an action to clean up the old recorderContext, in case
                //       the saga fails before recorderReady is sent.
            }

            yield put({type: ActionTypes.RecorderPreparing, payload: {progress: 'start'}});

            // Attempt to obtain an audio stream.  The async call will complete once
            // the user has granted permission to use the microphone.
            const stream = yield call(getAudioStream);
            yield put({type: ActionTypes.RecorderPreparing, payload: {progress: 'stream_ok'}});

            // Create the AudioContext, connect the nodes, and suspend the audio
            // context until we actually start recording.
            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            const scriptProcessor = audioContext.createScriptProcessor(
                /*bufferSize*/ 4096, /*numberOfInputChannels*/ 2, /*numberOfOutputChannels*/ 2);
            source.connect(analyser);
            source.connect(scriptProcessor);
            analyser.smoothingTimeConstant = 0.8;
            analyser.fftSize = 1024;
            scriptProcessor.connect(audioContext.destination);
            yield call(() => audioContext.suspend());
            yield put({type: ActionTypes.RecorderPreparing, payload: {progress: 'audio_ok'}});
            // Set up a worker to hold and encode the buffers.
            const worker = yield call(spawnWorker, AudioWorker);
            yield put({type: ActionTypes.RecorderPreparing, payload: {progress: 'worker_ok', worker}});
            // Initialize the worker.
            yield call(worker.call, 'init', {
                sampleRate: audioContext.sampleRate,
                numberOfChannels: source.channelCount
            });
            // XXX create a channel to which input buffers are posted.
            yield put({
                type: ActionTypes.RecorderPreparing, payload: {
                    progress: 'worker_init_ok', analyser
                }
            });
            // Set up the ScriptProcessor to divert all buffers to the worker.
            scriptProcessor.onaudioprocess = function(event) {
                // dispatch event
                // TODO: use same number of channels as in createScriptProcessor
                const ch0 = event.inputBuffer.getChannelData(0);
                const ch1 = event.inputBuffer.getChannelData(1);
                worker.post('addSamples', {samples: [ch0, ch1]});
            };
            // Signal that the recorder is ready to start, storing the new context.
            // /!\  Chrome: store a reference to the scriptProcessor node to prevent
            //      the browser from garbage-collection the node (which seems to
            //      occur even though the node is still connected).
            recorderContext = {audioContext, worker, scriptProcessor};
            yield put({type: ActionTypes.RecorderReady, payload: {recorderContext}});
        } catch (error) {
            // XXX send a specialized event and allow retrying recorderPrepare
            yield put({type: CommonActionTypes.Error, source: 'recorderPrepare', error});
        }
    }

    function* recorderStart() {
        try {
            // The user clicked the "start recording" button.
            const recorder = yield select(getRecorderState);
            const recorderStatus = recorder.get('status');
            if (recorderStatus !== 'ready') {
                console.log('not ready', recorder);
                return;
            }
            // Signal that the recorder is starting.
            yield put({type: ActionTypes.RecorderStarting});

            // Resume the audio context to start recording audio buffers.
            yield call(resumeAudioContext, recorder.get('context').audioContext);

            // Signal that recording has started.
            yield put({type: ActionTypes.RecorderStarted});

            /* Record the 'start' event */
            yield call(deps.recordApi.start);
        } catch (error) {
            // XXX generic error
            yield put({type: CommonActionTypes.Error, source: 'recorderStart', error});
        }
    }

    function* recorderStop() {
        try {
            let recorder = yield select(getRecorderState);
            let recorderStatus = recorder.get('status');
            if (!/recording|paused/.test(recorderStatus)) {
                /* Stop request in invalid state. */
                return;
            }

            /* Signal that the recorder is stopping. */
            yield put({type: ActionTypes.RecorderStopping});

            const {audioContext} = recorder.get('context');
            if (recorderStatus === 'recording') {
                /* Suspend the audio context to stop recording audio buffers. */
                yield call(suspendAudioContext, audioContext);
            }
            if (recorderStatus === 'paused') {
                /* When stopping while paused, the recording is truncated at the
                   playback position */
                const audioTime = yield select(st => getPlayerState(st).get('audioTime'));
                yield call(truncateRecording, audioTime, null);
            }

            /* Signal that the recorder has stopped. */
            yield put({type: ActionTypes.RecorderStopped, payload: {}});
        } catch (error) {
            // XXX generic error
            yield put({type: CommonActionTypes.Error, source: 'recorderStop', error});
        }
    }

    function* recorderPause() {
        try {
            const recorder = yield select(getRecorderState);
            if (recorder.get('status') !== 'recording') {
                return;
            }
            // Signal that the recorder is pausing.
            yield put({type: ActionTypes.RecorderPausing});
            const {audioContext, worker} = recorder.get('context');
            yield call(suspendAudioContext, audioContext);

            // Obtain the URL to a (WAV-encoded) audio object from the worker.
            const {wav, duration} = yield call(worker.call, 'export', {wav: true}, pauseExportProgressSaga);
            const audioUrl = URL.createObjectURL(wav);

            // Get a URL for events.
            const endTime = Math.floor(duration * 1000);
            const events = recorder.get('events').push([endTime, 'end']);
            const version = RECORDING_FORMAT_VERSION;
            const options = yield select(state => state.get('options'));
            const data = {version, options, events, subtitles: []};
            const eventsBlob = new Blob([JSON.stringify(data)], {
                type: "application/json;charset=UTF-8"
            });
            const eventsUrl = URL.createObjectURL(eventsBlob);
            // Prepare the player to use the audio and event streams, wait till ready.
            yield put({type: PlayerActionTypes.PlayerPrepare, payload: {audioUrl, eventsUrl}});
            yield take(PlayerActionTypes.PlayerReady);

            // Signal that the recorder is paused.
            yield put({type: ActionTypes.RecorderPaused});
        } catch (error) {
            // XXX generic error
            yield put({type: CommonActionTypes.Error, source: 'recorderPause', error});
        }

        function* pauseExportProgressSaga(progress) {
            // console.log('pause', progress);
        }
    }

    bundle.defineAction(ActionTypes.RecorderResume);

    bundle.defineAction(ActionTypes.RecorderResuming);
    bundle.addReducer(ActionTypes.RecorderResuming, (state, action) =>
        state.setIn(['recorder', 'status'], 'resuming')
    );

    bundle.defineAction(ActionTypes.RecorderResumed);
    bundle.addReducer(ActionTypes.RecorderResumed, (state, action) =>
        state.setIn(['recorder', 'status'], 'recording')
    );

    function* recorderResume() {
        try {
            const recorder = yield select(getRecorderState);
            const recorderStatus = recorder.get('status');
            const player = yield select(getPlayerState);
            const isPlaying = player.get('isPlaying');
            if (recorderStatus !== 'paused' || isPlaying) {
                console.log('bad state', recorderStatus);
                return;
            }

            /* Pause the player (even if already paused) to make sure the state
               accurately represents the instant in the recording. */
            yield put({type: PlayerActionTypes.PlayerPause});
            yield take(PlayerActionTypes.PlayerPaused);

            /* Clear the player's state. */
            yield put({type: PlayerActionTypes.PlayerClear});

            /* Signal that the recorder is resuming. */
            yield put({type: ActionTypes.RecorderResuming});

            /* Truncate the recording at the current playback position. */
            yield call(truncateRecording, player.get('audioTime'), player.get('current'));

            /* Resume the audio context to resume recording audio buffers. */
            yield call(resumeAudioContext, recorder.get('context').audioContext);

            // Signal that recording has resumed.
            yield put({type: ActionTypes.RecorderResumed});
        } catch (error) {
            // XXX generic error
            yield put({type: CommonActionTypes.Error, source: 'recorderResume', error});
        }
    }

    function* truncateRecording(audioTime, instant) {
        const {worker} = yield select(st => getRecorderState(st).get('context'));
        yield call(worker.call, 'truncate', {position: audioTime / 1000});
        if (instant) {
            const position = instant.pos + 1;
            yield put({type: ActionTypes.RecorderTruncate, payload: {audioTime, position}});
        }
    }

    function* resumeAudioContext(audioContext) {
        /* Race with timeout, in case the audio device is busy. */
        const outcome = yield race({
            resumed: call(() => audioContext.resume()),
            timeout: delay(1000)
        });
        if ('timeout' in outcome) {
            throw new Error('audio device is busy');
            /* Consider calling recorderPrepare to fix the issue?
               yield call(recorderPrepare);
             */
        }
    }

    function* suspendAudioContext(audioContext) {
        yield call(() => audioContext.suspend());
        const audioTime = Math.round(audioContext.currentTime * 1000);

        yield put({type: ActionTypes.AudioContextSuspended, payload: {audioTime}})
    }

    bundle.defineAction(ActionTypes.AudioContextSuspended);
    bundle.addReducer(ActionTypes.AudioContextSuspended, (state, {payload: {audioTime}}) =>
        state.setIn(['recorder', 'suspendedAt'], audioTime));

    bundle.addSaga(function* watchRecorderPrepare() {
        yield takeLatest(ActionTypes.RecorderPrepare, recorderPrepare);
    });

    bundle.addSaga(function* recorderTicker() {
        const {payload: {recorderContext}} = yield take(ActionTypes.RecorderReady);
        while (true) {
            yield take(ActionTypes.RecorderStarted);
            while (true) {
                const outcome = yield race({
                    tick: delay(1000),
                    stopped: take(ActionTypes.RecorderStopped)
                });
                if ('stopped' in outcome)
                    break;
                const junkTime = yield select(st => st.getIn(['recorder', 'junkTime']));
                const elapsed = Math.round(recorderContext.audioContext.currentTime * 1000) - junkTime;
                yield put({type: ActionTypes.RecorderTick, elapsed});
            }
        }
    });

    bundle.addSaga(function* watchRecorderActions() {
        yield takeEvery(ActionTypes.RecorderStart, recorderStart);
        yield takeEvery(ActionTypes.RecorderStop, recorderStop);
        yield takeEvery(ActionTypes.RecorderPause, recorderPause);
        yield takeEvery(ActionTypes.RecorderResume, recorderResume);
    });

    bundle.defer(function({replayApi}) {
        replayApi.on('end', function(replayContext, event) {
            replayContext.instant.isEnd = true;
            replayContext.state = replayContext.state.set('stopped', true);
        });
    });
};

function getAudioStream() {
    const constraints = {audio: true};
    if (typeof navigator.mediaDevices === 'object' && typeof navigator.mediaDevices.getUserMedia === 'function') {
        // Use modern API returning a promise.
        return navigator.mediaDevices.getUserMedia(constraints);
    } else {
        // Use deprecated API taking two callbacks.
        // @ts-ignore
      const getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
        return new Promise(function(resolve, reject) {
            getUserMedia.call(navigator, constraints, resolve, reject);
        });
    }
}
