import {
  ProviderButtonBaseProps,
  createMockProviderButton,
} from './ProviderLoginButton';

const MicrosoftLoginButton = createMockProviderButton({
  provider: 'microsoft',
  defaultLabel: 'Continuar com Microsoft (Simulado)',
  idToken:
    'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJpc3MiOiJodHRwczovL21pY3Jvc29mdC5jb20iLCJhdWQiOiJNSUNST1NPRlRfQ0xJRU5UX0lEIiwic3ViIjoibWljcm9zb2Z0LXVzZXItMTIzIiwiZW1haWwiOiJtaWNyb3NvZnRAZXhhbXBsZS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibmFtZSI6Ik1pY3Jvc29mdCBTaW11bGFkbyIsImlhdCI6MTcyNDIyNDAwMCwiZXhwIjoxNzI0MjI3NjAwfS5NSUNST1NPRlRTSU1VTEFETw==',
  sampleName: 'Microsoft Simulado',
  sampleEmail: 'microsoft@example.com',
});

export type MicrosoftLoginButtonProps = ProviderButtonBaseProps;
export default MicrosoftLoginButton;
