export interface AuthTokens {
  userId: string;
  token: string;
  refreshToken: string;
}

export interface IAuthRepository {
  login(username: string, password: string, baseUrl: string): Promise<AuthTokens>;
}
