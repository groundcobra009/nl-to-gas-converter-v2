
import React from 'react';

const Spinner: React.FC = () => {
  return (
    <div className="flex justify-center items-center my-4">
      <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-sky-500"></div>
    </div>
  );
};

export default Spinner;
