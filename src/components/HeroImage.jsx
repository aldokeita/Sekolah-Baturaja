import React from 'react';
import { DEFAULT_LOGO_PATH } from '@/lib/schoolAssets';

const HeroImage = () => {
  return (
    <div className='flex justify-center items-center'>
      <img
        src={DEFAULT_LOGO_PATH}
        alt='Placeholder logo sekolah'
      />
    </div>
  );
};

export default HeroImage;
