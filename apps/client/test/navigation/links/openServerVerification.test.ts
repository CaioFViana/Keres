import {
  openServerVerification,
  type VerificationNavigation,
} from '@/src/navigation/links/openServerVerification';

type Route = { name: string; params?: object } | undefined;

/** A navigation stub whose focused route follows what `navigate` was asked for, as the real container does. */
interface StubNavigation {
  current: Route;
  getCurrentRoute: () => Route;
  navigate: jest.Mock;
}

function stubNavigation(current: Route): StubNavigation {
  const stub: StubNavigation = {
    current,
    getCurrentRoute: () => stub.current,
    navigate: jest.fn((_name: string, nested: { params: { screen: string; params: object } }) => {
      // The focused route is the deepest one: the verification screen, not the drawer or the stack around it.
      stub.current = { name: nested.params.screen, params: nested.params.params };
    }),
  };
  return stub;
}

const verificationOf = (serverId: string): Route => ({
  name: 'ServerVerification',
  params: { serverId },
});

const expectedNavigation = {
  screen: 'ServerManagementDrawer',
  params: { screen: 'ServerVerification', params: { serverId: 'srv-1' } },
};

describe('openServerVerification', () => {
  it('leaves the registration screen alone: it shows the recovery codes first, then opens the check itself', () => {
    const navigation = stubNavigation({ name: 'ServerRegistration', params: {} });

    openServerVerification(navigation as unknown as VerificationNavigation, 'srv-1');

    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('opens the age check of the server, through the story selection and its server list', () => {
    const navigation = stubNavigation({ name: 'StorySelectionScreen' });

    openServerVerification(navigation as unknown as VerificationNavigation, 'srv-1');

    expect(navigation.navigate).toHaveBeenCalledWith('StorySelection', expectedNavigation);
  });

  it('navigates once for a burst of refusals: the screen is in front after the first', () => {
    const navigation = stubNavigation({ name: 'StorySelectionScreen' });
    const asNavigation = navigation as unknown as VerificationNavigation;

    openServerVerification(asNavigation, 'srv-1');
    openServerVerification(asNavigation, 'srv-1');
    openServerVerification(asNavigation, 'srv-1');

    expect(navigation.navigate).toHaveBeenCalledTimes(1);
  });

  it('leaves the age check alone while it is already in front for this server', () => {
    const navigation = stubNavigation(verificationOf('srv-1'));

    openServerVerification(navigation as unknown as VerificationNavigation, 'srv-1');

    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('moves to the age check of this server when another server verification is in front', () => {
    const navigation = stubNavigation(verificationOf('srv-2'));

    openServerVerification(navigation as unknown as VerificationNavigation, 'srv-1');

    expect(navigation.navigate).toHaveBeenCalledWith('StorySelection', expectedNavigation);
  });

  it('moves there from any other screen, even a deep one', () => {
    const navigation = stubNavigation({ name: 'Conversation', params: { serverId: 'srv-1' } });

    openServerVerification(navigation as unknown as VerificationNavigation, 'srv-1');

    expect(navigation.navigate).toHaveBeenCalledTimes(1);
  });
});
