import { errorMessageOf, httpStatusOf } from '@/src/utils/errors/errorInfo';

describe('errorMessageOf', () => {
  it('reads the message of an Error and of anything shaped like one', () => {
    expect(errorMessageOf(new Error('boom'))).toBe('boom');
    expect(errorMessageOf({ message: 'plain object' })).toBe('plain object');
  });

  it('answers undefined for values that carry no text message', () => {
    expect(errorMessageOf('a string')).toBeUndefined();
    expect(errorMessageOf(null)).toBeUndefined();
    expect(errorMessageOf(undefined)).toBeUndefined();
    expect(errorMessageOf({ message: 42 })).toBeUndefined();
  });
});

describe('httpStatusOf', () => {
  it('reads the status the server answered with', () => {
    expect(httpStatusOf({ response: { status: 404 } })).toBe(404);
  });

  it('answers undefined when the server did not answer or the shape is foreign', () => {
    expect(httpStatusOf(new Error('Network Error'))).toBeUndefined();
    expect(httpStatusOf({ response: { status: '404' } })).toBeUndefined();
    expect(httpStatusOf(null)).toBeUndefined();
    expect(httpStatusOf('nope')).toBeUndefined();
  });
});
