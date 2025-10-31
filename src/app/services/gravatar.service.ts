import { Injectable } from '@angular/core';
import md5 from 'md5';

@Injectable({
  providedIn: 'root'
})
export class GravatarService {
  private readonly gravatarBaseUrl = 'https://www.gravatar.com/avatar/';
  private readonly defaultSize = 40;

  constructor() { }

  /**
   * Generates a Gravatar URL from an email address
   * @param email User's email address
   * @param size Size of the avatar (default: 40px)
   * @param defaultImage Default image type (default: 'identicon')
   * @returns Gravatar URL
   */
  getAvatarUrl(email: string, size: number = this.defaultSize, defaultImage: string = 'identicon'): string {
    if (!email) {
      return `${this.gravatarBaseUrl}?s=${size}&d=${defaultImage}`;
    }

    // Gravatar requires lowercase and trimmed email
    const normalizedEmail = email.trim().toLowerCase();
    const hash = md5(normalizedEmail);

    return `${this.gravatarBaseUrl}${hash}?s=${size}&d=${defaultImage}`;
  }
}
