import React from 'react';
import { Composition, CalculateMetadataFunction } from 'remotion';
import { VaultMotionVideo } from './VaultMotionVideo';

const calculateMetadata: CalculateMetadataFunction<any> = ({ props }) => {
  return {
    durationInFrames: props.totalDurationInFrames || 1800,
  };
};

export function Root() {
  return (
    <Composition
      id="VaultMotionVideo"
      component={VaultMotionVideo as any}
      calculateMetadata={calculateMetadata}
      durationInFrames={1800}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        scenes: [
          {
            template: 'cinematic_title',
            duration_frames: 90,
            content: { title: 'VaultMotion', subtitle: 'AI Video Tool' },
            higgsfield_video_url: null
          },
          {
            template: 'stats_counter',
            duration_frames: 120,
            content: { stat_value: 1000000, stat_label: 'Views in 24 uur', text: 'Miljoen views' },
            higgsfield_video_url: null
          },
          {
            template: 'outro_cta',
            duration_frames: 150,
            content: { channel_name: '@VaultOfAges', message: 'Abonneer voor meer!' },
            higgsfield_video_url: null
          }
        ],
        wordTimings: [],
        subtitleSettings: {
          enabled: true,
          fontSize: 'normaal',
          highlightColor: '#e53e3e',
          position: 'onder'
        },
        totalDurationInFrames: 360
      }}
    />
  );
}
