import {
  ProviderButtonBaseProps,
  createMockProviderButton,
} from './ProviderLoginButton';

const GoogleLoginButton = createMockProviderButton({
  provider: 'google',
  defaultLabel: 'Continuar com Google (Simulado)',
  idToken:
    'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhdWQiOiJZT1VSR19HT09HTEVfQ0xJRU5UX0lEIiwic3ViIjoic2ltLXVzZXItMTIzIiwiZW1haWwiOiJsdWlnaUBleGFtcGxlLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJuYW1lIjoiTHVpZ2kgZGUgTWVuZXplcyBDb2xsZXNpIiwiaWF0IjoxNzI0MjI0MDAwLCJleHAiOjE3MjQyMjc2MDB9.SElHTkxZLVNJTlVBTEVEMA',
  sampleName: 'Luigi Simulado',
  sampleEmail: 'luigi@example.com',
});

export type GoogleLoginButtonProps = ProviderButtonBaseProps;
export default GoogleLoginButton;
