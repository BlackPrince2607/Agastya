/**
 * Web Metro shim — avoids bundling @mediapipe/tasks-vision (dynamic require breaks Metro).
 * handLandmarks.web.ts catches init failures and falls back to ROI estimates.
 */
export class FilesetResolver {
  static async forVisionTasks(): Promise<never> {
    throw new Error('mediapipe_web_shim');
  }
}

export class HandLandmarker {
  static async createFromOptions(): Promise<never> {
    throw new Error('mediapipe_web_shim');
  }
}
