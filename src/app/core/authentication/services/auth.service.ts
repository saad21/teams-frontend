import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { TokenService } from './token.service';
import {
  LoginRequest,
  LoginResponse,
  SignupRequest,
  User,
} from '../models/auth.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly API_URL = '/api/auth'; // Update with your actual API endpoint
  private currentUser$ = new BehaviorSubject<User | null>(null);
  private authenticated$ = new BehaviorSubject<boolean>(false);

  constructor(
    private http: HttpClient,
    private tokenService: TokenService
  ) {
    this.initializeAuth();
  }

  /**
   * Initialize authentication state on app startup
   */
  private initializeAuth(): void {
    if (this.tokenService.hasToken() && !this.tokenService.isTokenExpired()) {
      // Token exists and is valid, you can optionally fetch user details
      this.authenticated$.next(true);
    } else {
      // Token doesn't exist or is expired
      this.logout();
    }
  }

  /**
   * Login user with email and password
   * @param loginRequest Login credentials
   * @returns Observable of login response
   */
  login(loginRequest: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.API_URL}/login`, loginRequest)
      .pipe(
        tap((response) => {
          this.handleAuthResponse(response);
        }),
        catchError((error) => {
          this.authenticated$.next(false);
          throw error;
        })
      );
  }

  /**
   * Sign up a new user
   * @param signupRequest Signup details
   * @returns Observable of login response
   */
  signup(signupRequest: SignupRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.API_URL}/signup`, signupRequest)
      .pipe(
        tap((response) => {
          this.handleAuthResponse(response);
        }),
        catchError((error) => {
          this.authenticated$.next(false);
          throw error;
        })
      );
  }

  /**
   * Logout the current user
   */
  logout(): void {
    // Optionally send logout request to backend
    this.http.post(`${this.API_URL}/logout`, {}).subscribe({
      next: () => {
        this.clearAuth();
      },
      error: () => {
        // Clear auth data even if logout request fails
        this.clearAuth();
      },
    });
  }

  /**
   * Refresh the authentication token
   * @returns Observable with new token response
   */
  refreshToken(): Observable<LoginResponse> {
    const refreshToken = this.tokenService.getRefreshToken();
    if (!refreshToken) {
      this.logout();
      return of(null as any);
    }

    return this.http
      .post<LoginResponse>(`${this.API_URL}/refresh`, {
        refreshToken: refreshToken,
      })
      .pipe(
        tap((response) => {
          this.handleAuthResponse(response);
        }),
        catchError((error) => {
          this.logout();
          throw error;
        })
      );
  }

  /**
   * Verify if user is authenticated
   * @returns True if user is authenticated, false otherwise
   */
  isAuthenticated(): boolean {
    return (
      this.tokenService.hasToken() &&
      !this.tokenService.isTokenExpired()
    );
  }

  /**
   * Get current authentication status as observable
   * @returns Observable of authentication status
   */
  isAuthenticated$(): Observable<boolean> {
    return this.authenticated$.asObservable();
  }

  /**
   * Get current user
   * @returns Current user or null
   */
  getCurrentUser(): User | null {
    return this.currentUser$.value;
  }

  /**
   * Get current user as observable
   * @returns Observable of current user
   */
  getCurrentUser$(): Observable<User | null> {
    return this.currentUser$.asObservable();
  }

  /**
   * Get the current authentication token
   * @returns The current token or null
   */
  getToken(): string | null {
    return this.tokenService.getToken();
  }

  /**
   * Request password reset
   * @param email User's email
   * @returns Observable of reset response
   */
  requestPasswordReset(email: string): Observable<any> {
    return this.http.post(`${this.API_URL}/password-reset/request`, {
      email: email,
    });
  }

  /**
   * Reset password with reset token
   * @param token Reset token from email
   * @param newPassword New password
   * @returns Observable of reset response
   */
  resetPassword(token: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.API_URL}/password-reset/confirm`, {
      token: token,
      newPassword: newPassword,
    });
  }

  /**
   * Change password for authenticated user
   * @param oldPassword Current password
   * @param newPassword New password
   * @returns Observable of change response
   */
  changePassword(oldPassword: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.API_URL}/change-password`, {
      oldPassword: oldPassword,
      newPassword: newPassword,
    });
  }

  /**
   * Handle authentication response from server
   * @param response Login/Signup response
   */
  private handleAuthResponse(response: LoginResponse): void {
    // Store tokens
    this.tokenService.setToken(response.token);
    this.tokenService.setRefreshToken(response.refreshToken);

    // Calculate and store token expiry
    const expiryTime = Date.now() + response.expiresIn * 1000;
    this.tokenService.setTokenExpiry(expiryTime);

    // Update current user
    this.currentUser$.next(response.user);

    // Update authentication state
    this.authenticated$.next(true);
  }

  /**
   * Clear all authentication data
   */
  private clearAuth(): void {
    this.tokenService.clearTokens();
    this.currentUser$.next(null);
    this.authenticated$.next(false);
  }
}
