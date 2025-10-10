import {
  ProviderButtonBaseProps,
  createMockProviderButton,
} from './ProviderLoginButton';

const AppleLoginButton = createMockProviderButton({
  provider: 'apple',
  defaultLabel: 'Continuar com Apple (Simulado)',
  idToken:
    'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJpc3MiOiJodHRwczovL2lkLmFwcGxlLmNvbSIsImF1ZCI6IkFQUExFX0NMSUVOVF9JRCIsInN1YiI6ImFwcGxlLXVzZXItMTIzIiwiZW1haWwiOiJhcHBsZUBleGFtcGxlLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJuYW1lIjoiQXBwbGUgU2ltdWxhZG8iLCJpYXQiOjE3MjQyMjQwMDAsImV4cCI6MTcyNDIyNzYwMH0uQVBQTEVTSU1VTEFETw==',
  sampleName: 'Apple Simulado',
  sampleEmail: 'apple@example.com',
});

export type AppleLoginButtonProps = ProviderButtonBaseProps;
export default AppleLoginButton;
