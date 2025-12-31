global.chrome = {
  tabs: {
    query: jest.fn(async () => []),
    get: jest.fn(async () => null)
  },
  storage: {
    sync: {
      get: jest.fn(async () => ({})),
      set: jest.fn(async () => {})
    },
    local: {
      get: jest.fn(async () => ({})),
      set: jest.fn(async () => {})
    },
    onChanged: {
      addListener: jest.fn()
    }
  },
  runtime: {
    id: "test",
    openOptionsPage: jest.fn(),
    getURL: jest.fn((path) => `chrome-extension://test/${path}`),
    sendMessage: jest.fn(async () => ({}))
  }
};

