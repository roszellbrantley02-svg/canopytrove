import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { isBlockedIp } from './brandPageResolverService';

describe('isBlockedIp', () => {
  test('blocks IPv4 loopback + zero', () => {
    assert.equal(isBlockedIp('127.0.0.1'), true);
    assert.equal(isBlockedIp('127.255.255.254'), true);
    assert.equal(isBlockedIp('0.0.0.0'), true);
  });

  test('blocks IPv4 RFC1918', () => {
    assert.equal(isBlockedIp('10.0.0.1'), true);
    assert.equal(isBlockedIp('10.255.255.255'), true);
    assert.equal(isBlockedIp('172.16.0.1'), true);
    assert.equal(isBlockedIp('172.31.255.255'), true);
    assert.equal(isBlockedIp('192.168.1.1'), true);
  });

  test('blocks IPv4 link-local + cloud metadata', () => {
    assert.equal(isBlockedIp('169.254.0.1'), true);
    assert.equal(isBlockedIp('169.254.169.254'), true); // AWS/GCP metadata
  });

  test('blocks IPv4 CGNAT (100.64.0.0/10)', () => {
    assert.equal(isBlockedIp('100.64.0.1'), true);
    assert.equal(isBlockedIp('100.127.255.255'), true);
    // Boundary: 100.128.x is NOT CGNAT
    assert.equal(isBlockedIp('100.128.0.1'), false);
    assert.equal(isBlockedIp('100.63.255.255'), false);
  });

  test('blocks IPv4 multicast / reserved (224.0.0.0/4 and above)', () => {
    assert.equal(isBlockedIp('224.0.0.1'), true);
    assert.equal(isBlockedIp('239.255.255.255'), true);
    assert.equal(isBlockedIp('255.255.255.255'), true);
  });

  test('allows IPv4 public addresses', () => {
    assert.equal(isBlockedIp('8.8.8.8'), false);
    assert.equal(isBlockedIp('1.1.1.1'), false);
    assert.equal(isBlockedIp('142.250.80.46'), false);
    // Boundary: 172.15.x is public, not RFC1918
    assert.equal(isBlockedIp('172.15.0.1'), false);
    // Boundary: 172.32.x is public, not RFC1918
    assert.equal(isBlockedIp('172.32.0.1'), false);
  });

  test('blocks IPv6 loopback + unspecified', () => {
    assert.equal(isBlockedIp('::1'), true);
    assert.equal(isBlockedIp('::'), true);
  });

  test('blocks IPv6 link-local (fe80::/10)', () => {
    assert.equal(isBlockedIp('fe80::1'), true);
    assert.equal(isBlockedIp('FE80::abcd'), true); // case insensitive
  });

  test('blocks IPv6 unique local addresses (fc00::/7)', () => {
    assert.equal(isBlockedIp('fc00::1'), true);
    assert.equal(isBlockedIp('fd12:3456:789a::1'), true);
  });

  test('blocks IPv4-mapped IPv6 addresses', () => {
    assert.equal(isBlockedIp('::ffff:127.0.0.1'), true);
    assert.equal(isBlockedIp('::ffff:169.254.169.254'), true); // metadata via IPv4-mapped
    assert.equal(isBlockedIp('::ffff:192.168.1.1'), true);
    // Boundary: IPv4-mapped public IP should pass
    assert.equal(isBlockedIp('::ffff:8.8.8.8'), false);
  });

  test('blocks 6to4 representations of private IPv4 ranges', () => {
    // 2002:7f00:0001:: is the 6to4 prefix for 127.0.0.1
    assert.equal(isBlockedIp('2002:7f00:0001::1'), true);
    // 2002:a9fe:a9fe:: encodes 169.254.169.254
    assert.equal(isBlockedIp('2002:a9fe:a9fe::1'), true);
  });

  test('allows public IPv6 addresses', () => {
    assert.equal(isBlockedIp('2001:4860:4860::8888'), false); // Google DNS
    assert.equal(isBlockedIp('2606:4700:4700::1111'), false); // Cloudflare
  });

  test('rejects empty / malformed input', () => {
    assert.equal(isBlockedIp(''), true);
    assert.equal(isBlockedIp('not-an-ip'), false); // not an IP literal at all
    // The point: by the time we call isBlockedIp, we've already resolved
    // hostnames to IP literals via dns.lookup. Anything that isn't a
    // recognised IPv4 or IPv6 form is treated as "I can't reason about
    // this" — we let it through and rely on the upstream hostname check.
    // Empty string is special-cased to true so a malformed dns.lookup
    // result fails closed.
  });
});
