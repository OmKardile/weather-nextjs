"use client";
import Image from 'next/image';
import axios from 'axios';
import { useState } from 'react';
import { CiSearch } from 'react-icons/ci';
import Weather from './components/Weather';
import Spinner from './components/Spinner';

export default function Home() {
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState({});
  const [loading, setLoading] = useState(false);

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=c4da8104a821c9e57a982cd121cf6862`;

  const fetchWeather = (e) => {
    e.preventDefault();
    setLoading(true); 
    axios.get(url).then((response) => {
      setWeather(response.data);
      // console.log(response.data);
    });
    setCity('');
    setLoading(false);
  };

  if (loading) {
    return <Spinner />;
  } else {
    return (
      <div>
        <div className='absolute top-0 left-0 right-0 bottom-0 bg-black/40 max-sm:bg-black/50 z-[1]' />
        <Image
          src='https://images.unsplash.com/photo-1590055531615-f16d36ffe8ec?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1632&q=80 '
          layout='fill'
          className='object-cover blur max-sm:object-center'
        />

        <div className='relative flex justify-between items-center max-w-[500px] w-full m-auto pt-4 px-4 text-white z-10'>
          <form
            onSubmit={fetchWeather}
            className='flex justify-between items-center w-full m-auto p-3 bg-transparent border border-gray-300 text-white rounded-2xl'
          >
            <div>
              <input
                onChange={(e) => setCity(e.target.value)}
                className='bg-transparent border-none text-white focus:outline-none text-2xl'
                type='text'
                placeholder='Type City* Name'
              />
            </div>
            <button onClick={fetchWeather}>
              <CiSearch size={35} />
            </button>
          </form>
        </div>

        
        {weather.main && <Weather data={weather} />}
      </div>
    );
  }
}
