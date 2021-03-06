import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';

/**
 * An helper function to assert if an Observer produces the specified values.
 * It does not care about the time between values produced by the observer.
 * Returns a promise that either completes if test passed ok, or reject with an error message if not.
 * Note that with expectComplete and expectError both false, the returned promise is resolved as soon as the values array is matched.
 * The remainder of the observer behavior is not observed. If both flags are true, the function matches either a complete or an error.
 * @param obs$ The observer to test.
 * @param values The array of values to expect in the observable.
 * @param expectComplete If at the end of the expected values, the observer is expected to complete,
 *  if this parameter is true. If false, no expectation on complete is made.
 * @param expectError If after the expected values, the observer is expected to error. If false, no expectation on error is made.
 * @param matcher An equality function for matching the observable values with the values array provided.
 * @param valuePrinter a function to customize the printing of value in messages
 */
export function matchObservable<T>(
    obs$: Observable<T>,
    values: Array<T>,
    expectComplete: boolean = true,
    expectError: boolean = false,
    matcher: (actual: T, expected: T) => boolean = (a, b) => a === b,
    valuePrinter:  (v: T) => string = v => JSON.stringify(v),
): Promise<void>
{
    return new Promise<void>(matchObs);

    function matchObs(resolve: () => void, reject: (reason: string) => void)
    {
        let expectedStep = 0;
        const subs: Subscription = obs$.subscribe({ next, error, complete });
        return;

        function next(value)
        {
            // console.log('next: ', value, '; step: ', expectedStep);
            if (expectedStep === -1)
                return;

            if (expectedStep >= values.length)
                finalize('Too many values on observable: ' + valuePrinter(value));
            else
            {
                if (matcher(value, values[expectedStep]) === false)
                    finalize(`Values at index ${expectedStep} are expected to match. Received:\n`
                        + `${valuePrinter(value)}\nExpected:\n${valuePrinter(values[expectedStep])}`);
                else
                {
                    expectedStep++;
                    if (!expectComplete && !expectError && expectedStep === values.length)
                        finalize();
                }
            }
        }

        function error(err)
        {
            // console.log('Error: ', error, '\nstep: ', expectedStep);
            if (expectedStep === -1)
                return;

            if (expectError && expectedStep === values.length)
                finalize();
            else
                finalize(`Observable errored unexpectedly before emission index ${expectedStep}. Error: ${err.toString()}`);
        }

        function complete()
        {
            // console.log('Complete. step: ', expectedStep);
            if (expectedStep === -1)
                return;

            if (expectedStep === values.length)
                finalize();
            else
                finalize(`Observable completed unexpectedly after ${expectedStep} value emissions. `
                    + (expectedStep < values.length
                        ? 'Missing values from observable.'
                        : 'Too many values on observable.'));
        }

        /**
         * With a specified message, finalize() rejects the promise. Without message, it resolves the promise.
         * Also makes the unsubscribe from the observable, but only on the next tick.
         * Because in some circumstances, some subscription handlers are run before the .subscription() returns.
         * In that cases and if this function is called on that first call of the handler,
         * the variable subs will be null at the time finalize() is called.
         *
         * Also, expectedStep is invalidated and will guard any handler to run significant code
         * after the promise is resolved or rejected. This is because another handler can be called
         * on the same tick that the resolving/rejecting handler but before the unsubscribe takes place.
         */
        function finalize(message?: string)
        {
            expectedStep = -1;
            setTimeout(() => subs.unsubscribe(), 0);
            if (message)
                reject(message);
            else
                resolve();
        }
    }
}
