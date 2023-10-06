import { tykPlugin } from './plugin';

describe('tyk', () => {
  it('should export plugin', () => {
    expect(tykPlugin).toBeDefined();
  });
});
